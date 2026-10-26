import '../design/tokens.css'
import './settings.css'
import { Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { DEFAULT_SETTINGS } from '@shared/settings'
import type { SettingsBridge } from '@shared/bridge'
import type { SettingsSnapshot } from '@shared/ipc'
import { SettingsApp, SettingsNotice } from './SettingsApp'

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

/** Turns a crash anywhere in the page into a message instead of a blank window. */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  override render() {
    if (!this.state.error) return this.props.children
    return (
      <SettingsNotice
        title="Something went wrong"
        detail={`Settings hit an error: ${this.state.error.message}`}
        action={
          <button type="button" className="button" onClick={() => location.reload()}>
            Reload
          </button>
        }
      />
    )
  }
}

const dark = window.matchMedia('(prefers-color-scheme: dark)')
const applyTheme = (): void => {
  document.documentElement.dataset.theme = dark.matches ? 'dark' : 'light'
}
applyTheme()
dark.addEventListener('change', applyTheme)
// The main process adds #mica when the window has a Windows 11 Mica backdrop.
document.documentElement.dataset.material = location.hash === '#mica' ? 'mica' : 'solid'

const bridge = window.overdrawSettings ?? (import.meta.env.DEV ? previewBridge() : undefined)

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    {bridge ? (
      <SettingsApp bridge={bridge} />
    ) : (
      <SettingsNotice title="Settings didn’t load" detail="Overdraw’s connection to this window is missing. Close Settings and open it again." />
    )}
  </ErrorBoundary>
)
