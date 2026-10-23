import '../design/tokens.css'
import './settings.css'
import { createRoot } from 'react-dom/client'
import { DEFAULT_SETTINGS } from '@shared/settings'
import type { SettingsBridge } from '@shared/bridge'
import type { SettingsSnapshot } from '@shared/ipc'
import { SettingsApp } from './SettingsApp'

/** Browser-only stand-in for development; the app always has the real bridge. */
function previewBridge(): SettingsBridge {
  let snap: SettingsSnapshot = {
    settings: structuredClone(DEFAULT_SETTINGS),
    launchAtLogin: false,
    launchAtLoginAvailable: false,
    hotkeyStatus: { toggleDraw: 'ok', toggleVisibility: 'ok', clear: 'conflict', screenshot: 'ok' },
    version: 'preview',
    screenshotFolder: 'C:\\Users\\you\\Pictures\\Overdraw'
  }
  return {
    get: async () => snap,
    update: async (patch) => {
      snap = { ...snap, settings: { ...snap.settings, ...patch, hotkeys: { ...snap.settings.hotkeys, ...patch.hotkeys } } }
      return snap
    },
    reset: async () => snap,
    setLaunchAtLogin: async () => snap,
    suspendHotkeys: () => {},
    openFolder: () => {},
    onChange: () => () => {}
  }
}

const bridge = window.overdrawSettings ?? (import.meta.env.DEV ? previewBridge() : undefined)
if (!bridge) throw new Error('Overdraw bridge is unavailable.')

const dark = window.matchMedia('(prefers-color-scheme: dark)')
const applyTheme = (): void => {
  document.documentElement.dataset.theme = dark.matches ? 'dark' : 'light'
}
applyTheme()
dark.addEventListener('change', applyTheme)
// The main process adds #mica when the window has a Windows 11 Mica backdrop.
document.documentElement.dataset.material = location.hash === '#mica' ? 'mica' : 'solid'

createRoot(document.getElementById('root')!).render(<SettingsApp bridge={bridge} />)
