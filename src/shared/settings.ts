import { isValidAccelerator } from './accelerator'

export type HotkeyAction = 'toggleDraw' | 'toggleVisibility' | 'clear' | 'screenshot'

export const HOTKEY_ACTIONS: readonly HotkeyAction[] = [
  'toggleDraw',
  'toggleVisibility',
  'clear',
  'screenshot'
]

export const HOTKEY_LABELS: Record<HotkeyAction, { title: string; detail: string }> = {
  toggleDraw: { title: 'Draw', detail: 'Start drawing on the screen under the cursor, or stop.' },
  toggleVisibility: { title: 'Show or hide ink', detail: 'Hide every annotation without losing it.' },
  clear: { title: 'Clear screen', detail: 'Erase the annotations on the current screen.' },
  screenshot: { title: 'Screenshot', detail: 'Capture the screen with your annotations.' }
}

/** An empty string means the shortcut is turned off. */
export type Hotkeys = Record<HotkeyAction, string>

export interface Settings {
  hotkeys: Hotkeys
  /** Keep the canvas pinned to the screen: mouse wheel and pinch do not pan or zoom. */
  lockViewport: boolean
  /** Darken the screen slightly while drawing so ink stands out. */
  dimWhileDrawing: boolean
  /** Keep annotations visible (click-through) after leaving draw mode. */
  keepInkVisible: boolean
  /** Show the floating control bar while drawing. */
  showControlBar: boolean
  /** Copy screenshots to the clipboard as well as saving them. */
  screenshotToClipboard: boolean
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  hotkeys: {
    toggleDraw: 'Alt+Shift+P',
    toggleVisibility: 'Alt+Shift+H',
    clear: 'Alt+Shift+X',
    screenshot: 'Alt+Shift+4'
  },
  lockViewport: true,
  dimWhileDrawing: false,
  keepInkVisible: true,
  showControlBar: true,
  screenshotToClipboard: true
})

export type BooleanSettingKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never
}[keyof Settings]

export const BOOLEAN_SETTING_KEYS: readonly BooleanSettingKey[] = [
  'lockViewport',
  'dimWhileDrawing',
  'keepInkVisible',
  'showControlBar',
  'screenshotToClipboard'
]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Builds a complete, valid Settings object from untrusted input (a file on disk
 * or an IPC payload). Unknown keys are dropped and invalid values fall back to
 * defaults, so a corrupted settings file can never break the app.
 */
export function sanitizeSettings(input: unknown): Settings {
  const source = isRecord(input) ? input : {}
  const hotkeySource = isRecord(source.hotkeys) ? source.hotkeys : {}

  const hotkeys = {} as Hotkeys
  for (const action of HOTKEY_ACTIONS) {
    const value = hotkeySource[action]
    hotkeys[action] =
      typeof value === 'string' && (value === '' || isValidAccelerator(value))
        ? value
        : DEFAULT_SETTINGS.hotkeys[action]
  }

  const settings: Settings = { ...DEFAULT_SETTINGS, hotkeys }
  for (const key of BOOLEAN_SETTING_KEYS) {
    const value = source[key]
    if (typeof value === 'boolean') settings[key] = value
  }
  return settings
}

/** A partial update coming from the settings window. */
export type SettingsPatch = Partial<Omit<Settings, 'hotkeys'>> & { hotkeys?: Partial<Hotkeys> }

export function applySettingsPatch(current: Settings, patch: unknown): Settings {
  if (!isRecord(patch)) return current
  const merged = {
    ...current,
    ...patch,
    hotkeys: { ...current.hotkeys, ...(isRecord(patch.hotkeys) ? patch.hotkeys : {}) }
  }
  return sanitizeSettings(merged)
}
