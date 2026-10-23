import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { app, ipcMain, nativeTheme, Notification, shell, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { FOLDER_KINDS, IPC, OVERLAY_MODES, type FolderKind, type OverlayMode, type OverlayReport, type SettingsSnapshot } from '@shared/ipc'
import { captureDisplay, saveScreenshot } from './capture'
import { HotkeyManager } from './hotkeys'
import { OverlayManager } from './overlay-manager'
import { DEV_SERVER_URL, iconPath, isTrustedUrl, noticesPath, screenshotFolder } from './paths'
import { applySessionSecurity, registerAppProtocol, registerPrivilegedScheme } from './security'
import { SettingsStore } from './settings-store'
import { getSettingsWindow, openSettingsWindow } from './settings-window'
import { AppTray } from './tray'

const APP_ID = 'com.overdraw.app'

// ── Process-level hardening (must happen before `ready`) ───────────────────
app.enableSandbox()
registerPrivilegedScheme()

// Fuses already block --inspect; also refuse Chromium's remote debugging in
// installed builds, so no other local process can drive the overlay.
const debugSwitch = ['remote-debugging-port', 'remote-debugging-pipe'].some((s) => app.commandLine.hasSwitch(s))

if (app.isPackaged && debugSwitch) {
  app.exit(1)
} else if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.setAppUserModelId(APP_ID)
  void app.whenReady().then(main)
}

function main(): void {
  applySessionSecurity()
  registerAppProtocol()

  const store = new SettingsStore()
  // The store only reads on construction, so a missing file means first launch.
  const firstRun = !existsSync(store.file)
  const overlays = new OverlayManager(() => store.value)
  // Run from a clone (`npm start`), the login item is Electron's exe plus this
  // project folder. The portable .exe runs from a temporary folder it unpacks
  // on every launch, so it registers the .exe the user saved instead. Not
  // offered under the Vite dev server, which wouldn't be running at sign-in.
  const portableExe = process.env['PORTABLE_EXECUTABLE_FILE']
  const loginItem = !app.isPackaged
    ? { path: process.execPath, args: [app.getAppPath()] }
    : portableExe
      ? { path: portableExe }
      : {}
  const launchAtLoginAvailable = !DEV_SERVER_URL
  const launchAtLogin = (): boolean =>
    launchAtLoginAvailable && app.getLoginItemSettings(loginItem).openAtLogin
  let capturing = false

  // ── Actions ──────────────────────────────────────────────────────────────

  async function takeScreenshot(): Promise<void> {
    if (capturing) return
    capturing = true
    try {
      const display = overlays.captureTargetDisplay()
      const image = await overlays.withCleanFrame(display, () => captureDisplay(display))
      await saveScreenshot(image, store.value.screenshotToClipboard)
    } catch (error) {
      console.error('Screenshot failed:', error)
      notify('Screenshot failed', 'Windows did not return an image of the screen.')
    } finally {
      capturing = false
    }
  }

  async function openFolder(kind: FolderKind): Promise<void> {
    if (kind === 'licenses') {
      await shell.openPath(noticesPath())
      return
    }
    const folder = kind === 'screenshots' ? screenshotFolder() : dirname(store.file)
    await mkdir(folder, { recursive: true })
    await shell.openPath(folder)
  }

  function setLaunchAtLogin(enabled: boolean): void {
    if (!launchAtLoginAvailable) return
    app.setLoginItemSettings({ openAtLogin: enabled, ...loginItem })
    refresh()
  }

  const openSettings = (): void => {
    openSettingsWindow(() => hotkeys.setSuspended(false))
  }

  const hotkeys = new HotkeyManager({
    toggleDraw: () => void overlays.toggleDraw(),
    toggleVisibility: () => void overlays.toggleVisibility(),
    clear: () => overlays.clearCurrent(),
    screenshot: () => void takeScreenshot()
  })

  const tray = new AppTray({
    toggleDraw: () => void overlays.toggleDraw(),
    toggleVisibility: () => void overlays.toggleVisibility(),
    clearAll: () => overlays.clearAll(),
    screenshot: () => void takeScreenshot(),
    openScreenshots: () => void openFolder('screenshots'),
    openSettings,
    setLaunchAtLogin,
    quit: () => app.quit()
  })

  function snapshot(): SettingsSnapshot {
    return {
      settings: store.value,
      launchAtLogin: launchAtLogin(),
      launchAtLoginAvailable,
      hotkeyStatus: hotkeys.getStatus(),
      version: app.getVersion(),
      screenshotFolder: screenshotFolder()
    }
  }

  /** Push current state to the tray menu and the settings window. */
  function refresh(): void {
    tray.update({
      drawing: overlays.isDrawing,
      inkVisible: overlays.isAnyVisible,
      hasInk: overlays.hasInk,
      settings: store.value,
      launchAtLogin: launchAtLogin(),
      launchAtLoginAvailable
    })
    getSettingsWindow()?.webContents.send(IPC.settingsChanged, snapshot())
  }

  store.on('change', (settings) => {
    hotkeys.apply(settings.hotkeys)
    overlays.broadcastSettings(settings)
    refresh()
  })
  overlays.on('change', refresh)

  // ── IPC: overlays ────────────────────────────────────────────────────────
  // Every handler resolves the sender to a known overlay window first; any
  // message from anything else is dropped.

  const isMode = (value: unknown): value is OverlayMode => OVERLAY_MODES.includes(value as OverlayMode)

  ipcMain.handle(IPC.overlayInit, (event) => {
    const overlay = trusted(event) ? overlays.fromSender(event) : undefined
    if (!overlay) throw new Error('Unknown sender')
    return overlay.init()
  })

  ipcMain.on(IPC.overlayRequestMode, (event, mode: unknown) => {
    const overlay = trusted(event) ? overlays.fromSender(event) : undefined
    if (overlay && isMode(mode)) void overlays.setMode(overlay, mode)
  })

  ipcMain.on(IPC.overlayReport, (event, report: unknown) => {
    const overlay = trusted(event) ? overlays.fromSender(event) : undefined
    const count = (report as OverlayReport | null)?.elementCount
    if (overlay && Number.isSafeInteger(count) && (count as number) >= 0) {
      overlays.reportElementCount(overlay, count as number)
    }
  })

  ipcMain.on(IPC.overlayCaptureReady, (event, id: unknown) => {
    const overlay = trusted(event) ? overlays.fromSender(event) : undefined
    if (overlay && Number.isSafeInteger(id)) overlay.captureReady(id as number)
  })

  ipcMain.on(IPC.overlayScreenshot, (event) => {
    if (trusted(event) && overlays.fromSender(event)) void takeScreenshot()
  })

  ipcMain.on(IPC.overlayOpenSettings, (event) => {
    if (trusted(event) && overlays.fromSender(event)) {
      void overlays.stopDrawing()
      openSettings()
    }
  })

  // ── IPC: settings window ─────────────────────────────────────────────────

  const fromSettings = (event: IpcMainEvent | IpcMainInvokeEvent): boolean =>
    trusted(event) && getSettingsWindow()?.webContents.id === event.sender.id

  ipcMain.handle(IPC.settingsGet, (event) => {
    if (!fromSettings(event)) throw new Error('Unknown sender')
    return snapshot()
  })

  ipcMain.handle(IPC.settingsUpdate, (event, patch: unknown) => {
    if (!fromSettings(event)) throw new Error('Unknown sender')
    store.update(patch)
    return snapshot()
  })

  ipcMain.handle(IPC.settingsReset, (event) => {
    if (!fromSettings(event)) throw new Error('Unknown sender')
    store.reset()
    return snapshot()
  })

  ipcMain.handle(IPC.settingsSetLaunchAtLogin, (event, enabled: unknown) => {
    if (!fromSettings(event)) throw new Error('Unknown sender')
    if (typeof enabled === 'boolean') setLaunchAtLogin(enabled)
    return snapshot()
  })

  ipcMain.on(IPC.settingsSuspendHotkeys, (event, suspended: unknown) => {
    if (fromSettings(event) && typeof suspended === 'boolean') hotkeys.setSuspended(suspended)
  })

  ipcMain.on(IPC.settingsOpenFolder, (event, kind: unknown) => {
    if (fromSettings(event) && FOLDER_KINDS.includes(kind as FolderKind)) void openFolder(kind as FolderKind)
  })

  // ── Lifecycle ────────────────────────────────────────────────────────────

  // Launching the app again (Start menu, shortcut) means "I want to draw".
  app.on('second-instance', () => void overlays.startDrawing())
  // A tray app keeps running with no windows open.
  app.on('window-all-closed', () => {})
  app.on('before-quit', () => {
    hotkeys.dispose()
    overlays.dispose()
    tray.destroy()
  })
  nativeTheme.on('updated', refresh)

  const status = hotkeys.apply(store.value.hotkeys)
  refresh()

  if (status.toggleDraw === 'conflict') {
    notify(
      'Shortcut unavailable',
      `${store.value.hotkeys.toggleDraw} is used by another app. Choose a different one in Settings.`,
      openSettings
    )
  } else if (firstRun) {
    store.save()
    const shortcut = store.value.hotkeys.toggleDraw
    notify(
      'Overdraw is ready',
      `Press ${shortcut} or click the tray icon to draw on your screen. Press Esc when you are done.`
    )
  }
}

function trusted(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url
  return typeof url === 'string' && isTrustedUrl(url)
}

function notify(title: string, body: string, onClick?: () => void): void {
  if (!Notification.isSupported()) return
  const note = new Notification({ title, body, icon: iconPath('icon.png'), silent: true })
  if (onClick) note.on('click', onClick)
  note.show()
}
