import { EventEmitter } from 'node:events'
import { app, BrowserWindow, nativeTheme, screen, type Display, type IpcMainEvent, type WebContents } from 'electron'
import { IPC, type OverlayCommand, type OverlayInit, type OverlayMode } from '@shared/ipc'
import type { Settings } from '@shared/settings'
import { pageUrl, preloadPath } from './paths'

const CAPTURE_PREPARE_TIMEOUT_MS = 750

/**
 * One transparent, always-on-top window covering a single display.
 * Windows are created lazily the first time a display is drawn on and are
 * kept (hidden) afterwards so annotations survive leaving draw mode.
 */
class Overlay {
  readonly win: BrowserWindow
  mode: OverlayMode = 'hidden'
  elementCount = 0
  private loaded: Promise<void>
  private captureWaiters = new Map<number, () => void>()

  constructor(
    readonly displayId: number,
    bounds: Electron.Rectangle,
    private readonly getSettings: () => Settings
  ) {
    this.win = new BrowserWindow({
      ...bounds,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: false,
      thickFrame: false,
      roundedCorners: false,
      title: 'Overdraw',
      webPreferences: {
        preload: preloadPath('overlay'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        spellcheck: false,
        backgroundThrottling: false,
        devTools: !app.isPackaged
      }
    })
    // "screen-saver" sits above the taskbar and borderless-fullscreen games.
    this.win.setAlwaysOnTop(true, 'screen-saver')
    this.win.setIgnoreMouseEvents(true)
    this.win.webContents.setVisualZoomLevelLimits(1, 1)
    if (!app.isPackaged) {
      // Surface renderer warnings (CSP violations, load errors) in the terminal.
      // Excalidraw always lists a CDN copy of each font after our local one;
      // CSP blocking that fallback is expected, so it is not reported.
      this.win.webContents.on('console-message', ({ level, message }) => {
        if (level !== 'warning' && level !== 'error') return
        if (message.includes('esm.sh/@excalidraw') && message.includes('font-src')) return
        console.warn(`[overlay ${level}] ${message}`)
      })
    }
    this.loaded = this.win.loadURL(pageUrl('overlay')).catch((error) => {
      console.error('Overlay failed to load:', error)
    })
  }

  get contents(): WebContents {
    return this.win.webContents
  }

  get isVisible(): boolean {
    return this.mode !== 'hidden'
  }

  send(command: OverlayCommand): void {
    if (!this.win.isDestroyed()) this.contents.send(IPC.overlayCommand, command)
  }

  init(): OverlayInit {
    return {
      mode: this.mode,
      settings: this.getSettings(),
      theme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    }
  }

  async setMode(requested: OverlayMode): Promise<void> {
    if (this.win.isDestroyed()) return
    // Nothing to show: a click-through window with no ink would only cost
    // compositor time over games and video, so hide it instead.
    const mode =
      requested === 'passive' && (this.elementCount === 0 || !this.getSettings().keepInkVisible)
        ? 'hidden'
        : requested
    const previous = this.mode
    this.mode = mode
    this.send({ type: 'mode', mode })

    if (mode === 'drawing') {
      await this.loaded
      this.win.setIgnoreMouseEvents(false)
      this.win.setFocusable(true)
      this.win.setAlwaysOnTop(true, 'screen-saver')
      this.win.show()
      this.win.moveTop()
      this.win.focus()
      return
    }

    if (previous === 'drawing') this.win.blur()
    this.win.setIgnoreMouseEvents(true)
    this.win.setFocusable(false)
    if (mode === 'passive') this.win.showInactive()
    else this.win.hide()
  }

  /** Hide the editor UI and wait until the renderer has painted without it. */
  prepareCapture(id: number): Promise<void> {
    if (!this.isVisible) return Promise.resolve()
    return new Promise((resolve) => {
      const done = (): void => {
        clearTimeout(timer)
        this.captureWaiters.delete(id)
        resolve()
      }
      // Never let a stuck renderer block the screenshot.
      const timer = setTimeout(done, CAPTURE_PREPARE_TIMEOUT_MS)
      this.captureWaiters.set(id, done)
      this.send({ type: 'prepare-capture', id })
    })
  }

  captureReady(id: number): void {
    this.captureWaiters.get(id)?.()
  }

  setBounds(bounds: Electron.Rectangle): void {
    if (!this.win.isDestroyed()) this.win.setBounds(bounds)
  }

  destroy(): void {
    for (const done of this.captureWaiters.values()) done()
    if (!this.win.isDestroyed()) this.win.destroy()
  }
}

type ManagerEvents = { change: [] }

export class OverlayManager extends EventEmitter<ManagerEvents> {
  private overlays = new Map<number, Overlay>()
  private captureCounter = 0

  constructor(private readonly getSettings: () => Settings) {
    super()
    screen.on('display-removed', (_e, display) => this.dropDisplay(display.id))
    screen.on('display-metrics-changed', (_e, display) => {
      this.overlays.get(display.id)?.setBounds(display.bounds)
    })
  }

  // ── Queries ────────────────────────────────────────────────────────────

  get isDrawing(): boolean {
    return this.drawingOverlay() !== undefined
  }

  get isAnyVisible(): boolean {
    return [...this.overlays.values()].some((o) => o.isVisible)
  }

  get hasInk(): boolean {
    return [...this.overlays.values()].some((o) => o.elementCount > 0)
  }

  /** Resolve an IPC sender to its overlay; unknown senders get undefined. */
  fromSender(event: IpcMainEvent | Electron.IpcMainInvokeEvent): Overlay | undefined {
    for (const overlay of this.overlays.values()) {
      if (!overlay.win.isDestroyed() && overlay.contents.id === event.sender.id) return overlay
    }
    return undefined
  }

  // ── Commands ───────────────────────────────────────────────────────────

  /** Start drawing on the display under the cursor, or stop if already drawing. */
  async toggleDraw(): Promise<void> {
    const active = this.drawingOverlay()
    if (active) await this.setMode(active, 'passive')
    else await this.startDrawing()
  }

  async startDrawing(display: Display = this.cursorDisplay()): Promise<void> {
    for (const overlay of this.overlays.values()) {
      if (overlay.mode === 'drawing' && overlay.displayId !== display.id) {
        await this.setMode(overlay, 'passive')
      }
    }
    await this.setMode(this.ensureOverlay(display), 'drawing')
  }

  async stopDrawing(): Promise<void> {
    const active = this.drawingOverlay()
    if (active) await this.setMode(active, 'passive')
  }

  /** Hide every annotation, or bring them all back. */
  async toggleVisibility(): Promise<void> {
    const show = !this.isAnyVisible
    for (const overlay of this.overlays.values()) {
      await this.setMode(overlay, show ? 'passive' : 'hidden')
    }
  }

  clearCurrent(): void {
    const target = this.drawingOverlay() ?? this.overlays.get(this.cursorDisplay().id)
    target?.send({ type: 'clear' })
  }

  clearAll(): void {
    for (const overlay of this.overlays.values()) overlay.send({ type: 'clear' })
  }

  async setMode(overlay: Overlay, mode: OverlayMode): Promise<void> {
    await overlay.setMode(mode)
    this.emit('change')
  }

  /** Display for a screenshot: the one being drawn on, else the one under the cursor. */
  captureTargetDisplay(): Display {
    const active = this.drawingOverlay()
    if (active) {
      const display = screen.getAllDisplays().find((d) => d.id === active.displayId)
      if (display) return display
    }
    return this.cursorDisplay()
  }

  /** Run `capture` while the overlay on `display` shows ink only (no editor UI). */
  async withCleanFrame<T>(display: Display, capture: () => Promise<T>): Promise<T> {
    const overlay = this.overlays.get(display.id)
    if (!overlay) return capture()
    const id = ++this.captureCounter
    await overlay.prepareCapture(id)
    try {
      return await capture()
    } finally {
      overlay.send({ type: 'end-capture' })
    }
  }

  // ── Renderer reports ───────────────────────────────────────────────────

  reportElementCount(overlay: Overlay, count: number): void {
    overlay.elementCount = count
    // Ink was cleared while click-through: nothing left to show.
    if (count === 0 && overlay.mode === 'passive') void this.setMode(overlay, 'hidden')
    else this.emit('change')
  }

  broadcastSettings(settings: Settings): void {
    for (const overlay of this.overlays.values()) {
      overlay.send({ type: 'settings', settings })
      if (overlay.mode === 'passive' && !settings.keepInkVisible) void this.setMode(overlay, 'hidden')
    }
  }

  dispose(): void {
    for (const overlay of this.overlays.values()) overlay.destroy()
    this.overlays.clear()
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private drawingOverlay(): Overlay | undefined {
    return [...this.overlays.values()].find((o) => o.mode === 'drawing')
  }

  private cursorDisplay(): Display {
    return screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  }

  private ensureOverlay(display: Display): Overlay {
    const existing = this.overlays.get(display.id)
    if (existing && !existing.win.isDestroyed()) return existing

    const overlay = new Overlay(display.id, display.bounds, this.getSettings)
    this.overlays.set(display.id, overlay)
    // Windows can mis-size a window created on a monitor with a different
    // scale factor; re-applying the bounds once it exists fixes it.
    overlay.setBounds(display.bounds)

    overlay.win.on('closed', () => {
      if (this.overlays.get(display.id) === overlay) this.overlays.delete(display.id)
      this.emit('change')
    })
    overlay.contents.on('render-process-gone', (_e, details) => {
      console.error(`Overlay renderer exited (${details.reason}); it will be recreated on next use.`)
      this.dropDisplay(display.id)
    })
    return overlay
  }

  private dropDisplay(displayId: number): void {
    const overlay = this.overlays.get(displayId)
    if (!overlay) return
    this.overlays.delete(displayId)
    overlay.destroy()
    this.emit('change')
  }
}

export type { Overlay }
