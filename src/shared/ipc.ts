import type { HotkeyAction, Settings } from './settings'

/**
 * Every IPC channel and payload in one place. Main validates everything it
 * receives; renderers are treated as untrusted.
 */
export const IPC = {
  overlayInit: 'overlay:init',
  overlayCommand: 'overlay:command',
  overlayRequestMode: 'overlay:request-mode',
  overlayReport: 'overlay:report',
  overlayCaptureReady: 'overlay:capture-ready',
  overlayScreenshot: 'overlay:screenshot',
  overlayOpenSettings: 'overlay:open-settings',

  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  settingsReset: 'settings:reset',
  settingsSetLaunchAtLogin: 'settings:set-launch-at-login',
  settingsSuspendHotkeys: 'settings:suspend-hotkeys',
  settingsOpenFolder: 'settings:open-folder',
  settingsChanged: 'settings:changed'
} as const

/**
 * - drawing: the overlay captures mouse, pen and keyboard input.
 * - passive: ink stays visible; all input passes through to the apps below.
 * - hidden:  the overlay window is not shown at all.
 */
export type OverlayMode = 'drawing' | 'passive' | 'hidden'

export const OVERLAY_MODES: readonly OverlayMode[] = ['drawing', 'passive', 'hidden']

export type Theme = 'light' | 'dark'

export interface OverlayInit {
  mode: OverlayMode
  settings: Settings
  theme: Theme
}

export type OverlayCommand =
  | { type: 'mode'; mode: OverlayMode }
  | { type: 'settings'; settings: Settings }
  | { type: 'clear' }
  | { type: 'prepare-capture'; id: number }
  | { type: 'end-capture' }

export interface OverlayReport {
  /** Number of visible (non-deleted) elements on this overlay. */
  elementCount: number
}

export type HotkeyStatus = 'ok' | 'conflict' | 'off'

export interface SettingsSnapshot {
  settings: Settings
  launchAtLogin: boolean
  /** False under the Vite dev server, which is not running at sign-in. */
  launchAtLoginAvailable: boolean
  hotkeyStatus: Record<HotkeyAction, HotkeyStatus>
  version: string
  screenshotFolder: string
}

/** Things the settings window may ask main to open in Explorer. */
export type FolderKind = 'screenshots' | 'settings' | 'licenses'

export const FOLDER_KINDS: readonly FolderKind[] = ['screenshots', 'settings', 'licenses']
