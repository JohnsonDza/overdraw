import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { CaptureUpdateAction, Excalidraw, MainMenu, newElementWith } from '@excalidraw/excalidraw'
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI, LibraryItems } from '@excalidraw/excalidraw/types'
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { OverlayBridge } from '@shared/bridge'
import type { OverlayInit, OverlayMode, Theme } from '@shared/ipc'
import type { Settings } from '@shared/settings'
import { ControlBar } from './ControlBar'
import { CameraIcon, GearIcon } from './icons'
import {
  MARKER_COLORS,
  MARKER_OPACITY,
  MARKER_WIDTH,
  PEN_COLORS,
  PEN_WIDTH,
  presetFor,
  type Preset,
  type PresetStyle
} from './presets'

const LIBRARY_KEY = 'overdraw.library.v1'
const BOARD_COLOR = '#ffffff' // Excalidraw inverts this to near-black in dark theme.

function loadLibrary(): LibraryItems {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as LibraryItems) : []
  } catch {
    return []
  }
}

function saveLibrary(items: LibraryItems): void {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(items))
  } catch {
    // Storage full or unavailable: the library simply is not remembered.
  }
}

/** True while the editor is mid-interaction, so Esc belongs to Excalidraw. */
function isEditorBusy(s: AppState): boolean {
  return Boolean(
    s.editingTextElement ||
      s.newElement ||
      s.multiElement ||
      s.selectionElement ||
      s.editingLinearElement ||
      s.croppingElementId ||
      s.openDialog ||
      s.openMenu ||
      s.openPopup ||
      s.contextMenu ||
      s.showHyperlinkPopup ||
      Object.keys(s.selectedElementIds).length > 0
  )
}

const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]') !== null

interface Props {
  bridge: OverlayBridge
  init: OverlayInit
}

export function OverlayApp({ bridge, init }: Props) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const [mode, setMode] = useState<OverlayMode>(init.mode)
  const [settings, setSettings] = useState<Settings>(init.settings)
  const [theme, setTheme] = useState<Theme>(init.theme)
  const [capturing, setCapturing] = useState(false)
  const [preset, setPreset] = useState<Preset | null>('pen')
  const [color, setColor] = useState<string>(PEN_COLORS[0].value)
  const [boardOn, setBoardOn] = useState(false)
  const [viewMoved, setViewMoved] = useState(false)
  const [elementCount, setElementCount] = useState(0)

  // Event handlers registered once read the latest values through refs.
  const modeRef = useRef(mode)
  const settingsRef = useRef(settings)
  const presetRef = useRef<Preset | null>(preset)
  const reportedCount = useRef(-1)
  const styles = useRef<Record<'pen' | 'marker', PresetStyle>>({
    pen: { color: PEN_COLORS[0].value, width: PEN_WIDTH, opacity: 100 },
    marker: { color: MARKER_COLORS[0].value, width: MARKER_WIDTH, opacity: MARKER_OPACITY }
  })
  modeRef.current = mode
  settingsRef.current = settings

  const initialData = useMemo(
    () => ({
      appState: {
        viewBackgroundColor: 'transparent',
        theme: init.theme,
        currentItemStrokeColor: PEN_COLORS[0].value,
        currentItemStrokeWidth: PEN_WIDTH,
        currentItemOpacity: 100,
        scrollX: 0,
        scrollY: 0
      },
      libraryItems: loadLibrary()
    }),
    [init.theme]
  )

  // ── Presets ─────────────────────────────────────────────────────────────

  const applyPreset = useCallback(
    (next: Preset) => {
      if (!api) return
      if (next === 'laser') {
        api.setActiveTool({ type: 'laser' })
        return
      }
      const style = styles.current[next]
      api.updateScene({
        appState: {
          currentItemStrokeColor: style.color,
          currentItemStrokeWidth: style.width,
          currentItemOpacity: style.opacity
        },
        captureUpdate: CaptureUpdateAction.NEVER
      })
      api.setActiveTool({ type: 'freedraw' })
    },
    [api]
  )

  const applyColor = useCallback(
    (value: string) => {
      if (!api) return
      const target = presetRef.current === 'marker' ? 'marker' : 'pen'
      styles.current[target].color = value
      applyPreset(target)
    },
    [api, applyPreset]
  )

  // ── Excalidraw change stream (fires often: keep it cheap) ───────────────

  const onChange = useCallback(
    (elements: readonly OrderedExcalidrawElement[], appState: AppState, _files: BinaryFiles) => {
      let count = 0
      for (const el of elements) if (!el.isDeleted) count++
      if (count !== reportedCount.current) {
        reportedCount.current = count
        setElementCount(count)
        bridge.report({ elementCount: count })
      }

      const nextPreset = presetFor(appState.activeTool.type, appState.currentItemOpacity)
      const previous = presetRef.current
      if (nextPreset === 'pen' || nextPreset === 'marker') {
        styles.current[nextPreset].color = appState.currentItemStrokeColor
        styles.current[nextPreset].width = appState.currentItemStrokeWidth
      }
      // Leaving the highlighter for a shape tool must not leave shapes translucent.
      if (previous === 'marker' && nextPreset === null && appState.currentItemOpacity === MARKER_OPACITY && api) {
        const pen = styles.current.pen
        queueMicrotask(() =>
          api.updateScene({
            appState: {
              currentItemOpacity: 100,
              currentItemStrokeColor: pen.color,
              currentItemStrokeWidth: pen.width
            },
            captureUpdate: CaptureUpdateAction.NEVER
          })
        )
      }
      if (nextPreset !== previous) {
        presetRef.current = nextPreset
        setPreset(nextPreset)
      }
      setColor((c) => (c === appState.currentItemStrokeColor ? c : appState.currentItemStrokeColor))
      setTheme((t) => (t === appState.theme ? t : appState.theme))
      const board = appState.viewBackgroundColor !== 'transparent'
      setBoardOn((b) => (b === board ? b : board))
    },
    [api, bridge]
  )

  const onScrollChange = useCallback((scrollX: number, scrollY: number, zoom: AppState['zoom']) => {
    const moved = Math.abs(scrollX) > 0.5 || Math.abs(scrollY) > 0.5 || Math.abs(zoom.value - 1) > 0.001
    setViewMoved((m) => (m === moved ? m : moved))
  }, [])

  // ── Commands from the main process ─────────────────────────────────────

  const clearScreen = useCallback(() => {
    if (!api) return
    const elements = api.getSceneElementsIncludingDeleted()
    if (elements.every((el) => el.isDeleted)) return
    // Mark as deleted (like Excalidraw's own "Reset canvas") so Ctrl+Z restores it.
    api.updateScene({
      elements: elements.map((el) => (el.isDeleted ? el : newElementWith(el, { isDeleted: true }))),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY
    })
  }, [api])

  const deselectAll = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur() // commits text editing
    api?.updateScene({
      appState: { selectedElementIds: {}, openMenu: null, openPopup: null, contextMenu: null },
      captureUpdate: CaptureUpdateAction.NEVER
    })
  }, [api])

  useEffect(() => {
    return bridge.onCommand((command) => {
      switch (command.type) {
        case 'mode':
          if (command.mode !== 'drawing') deselectAll()
          setMode(command.mode)
          break
        case 'settings':
          setSettings(command.settings)
          break
        case 'clear':
          clearScreen()
          break
        case 'prepare-capture':
          flushSync(() => setCapturing(true))
          deselectAll()
          // Two frames: one to apply the styles, one to be sure it is on screen.
          requestAnimationFrame(() => requestAnimationFrame(() => bridge.captureReady(command.id)))
          break
        case 'end-capture':
          setCapturing(false)
          break
      }
    })
  }, [bridge, clearScreen, deselectAll])

  // ── Keyboard and wheel, captured before Excalidraw sees them ───────────

  useEffect(() => {
    if (!api) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (modeRef.current !== 'drawing' || isTypingTarget(event.target)) return
      if (event.key === 'Escape') {
        if (isEditorBusy(api.getAppState())) return
        event.preventDefault()
        event.stopPropagation()
        bridge.requestMode('passive')
        return
      }
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
      const key = event.key.toLowerCase()
      // P/X is Excalidraw's pen; route it through our presets so it never
      // inherits the highlighter's transparency. M is our highlighter.
      const next: Preset | null = key === 'm' ? 'marker' : key === 'p' || key === 'x' ? 'pen' : null
      if (next) {
        event.preventDefault()
        event.stopPropagation()
        applyPreset(next)
      }
    }
    // With the canvas pinned to the screen, the wheel must not pan or zoom it.
    // UI panels (menus, library) still scroll because only the canvas is blocked.
    const onWheel = (event: WheelEvent): void => {
      if (!settingsRef.current.lockViewport || !(event.target instanceof HTMLCanvasElement)) return
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('wheel', onWheel, { capture: true, passive: false })
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('wheel', onWheel, true)
    }
  }, [api, bridge, applyPreset])

  // Start with the pen so you can draw the moment the overlay appears.
  useEffect(() => {
    if (api) applyPreset('pen')
  }, [api, applyPreset])

  // Put keyboard focus in the editor whenever drawing starts.
  useEffect(() => {
    if (mode === 'drawing') window.focus()
  }, [mode])

  // Reflect state on <html> so CSS can drive appearance without re-rendering Excalidraw.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.mode = mode
    root.dataset.capturing = String(capturing)
    root.dataset.dim = String(settings.dimWhileDrawing && !boardOn)
    root.dataset.theme = theme
    root.dataset.bar = String(settings.showControlBar)
  }, [mode, capturing, settings.dimWhileDrawing, settings.showControlBar, boardOn, theme])

  const toggleBoard = useCallback(() => {
    api?.updateScene({
      appState: { viewBackgroundColor: boardOn ? 'transparent' : BOARD_COLOR },
      captureUpdate: CaptureUpdateAction.NEVER
    })
  }, [api, boardOn])

  const resetView = useCallback(() => {
    api?.updateScene({
      appState: { scrollX: 0, scrollY: 0, zoom: { value: 1 as AppState['zoom']['value'] } },
      captureUpdate: CaptureUpdateAction.NEVER
    })
  }, [api])

  const done = useCallback(() => bridge.requestMode('passive'), [bridge])

  return (
    <>
      <div className="od-frame" aria-hidden="true" />
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={initialData}
        onChange={onChange}
        onScrollChange={onScrollChange}
        onLibraryChange={saveLibrary}
        handleKeyboardGlobally
        autoFocus
        aiEnabled={false}
        // No third-party iframes (YouTube, Figma…): the app is offline-only.
        validateEmbeddable={() => false}
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: true,
            clearCanvas: true,
            export: { saveFileToDisk: true },
            loadScene: true,
            saveToActiveFile: true,
            saveAsImage: true,
            toggleTheme: true
          },
          tools: { image: true }
        }}
      >
        <MainMenu>
          <MainMenu.Item icon={<CameraIcon />} onSelect={() => bridge.screenshot()}>
            Screenshot with annotations
          </MainMenu.Item>
          <MainMenu.Separator />
          <MainMenu.DefaultItems.LoadScene />
          <MainMenu.DefaultItems.SaveToActiveFile />
          <MainMenu.DefaultItems.Export />
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.CommandPalette />
          <MainMenu.DefaultItems.SearchMenu />
          <MainMenu.DefaultItems.Help />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ToggleTheme />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
          <MainMenu.Separator />
          <MainMenu.Item icon={<GearIcon />} onSelect={() => bridge.openSettings()}>
            Overdraw settings…
          </MainMenu.Item>
        </MainMenu>
      </Excalidraw>
      {/* Outside Excalidraw's footer so it sits at the true centre of the screen. */}
      <ControlBar
        preset={preset}
        color={color}
        boardOn={boardOn}
        viewMoved={viewMoved}
        hasInk={elementCount > 0}
        screenshotShortcut={settings.hotkeys.screenshot}
        onPreset={applyPreset}
        onColor={applyColor}
        onToggleBoard={toggleBoard}
        onResetView={resetView}
        onClear={clearScreen}
        onScreenshot={() => bridge.screenshot()}
        onSettings={() => bridge.openSettings()}
        onDone={done}
      />
    </>
  )
}
