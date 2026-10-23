import type { FolderKind, OverlayCommand, OverlayInit, OverlayMode, OverlayReport, SettingsSnapshot } from './ipc'
import type { SettingsPatch } from './settings'

/** Exposed to the overlay page as `window.overdraw`. */
export interface OverlayBridge {
  init(): Promise<OverlayInit>
  onCommand(listener: (command: OverlayCommand) => void): () => void
  requestMode(mode: OverlayMode): void
  report(report: OverlayReport): void
  captureReady(id: number): void
  screenshot(): void
  openSettings(): void
}

/** Exposed to the settings page as `window.overdrawSettings`. */
export interface SettingsBridge {
  get(): Promise<SettingsSnapshot>
  update(patch: SettingsPatch): Promise<SettingsSnapshot>
  reset(): Promise<SettingsSnapshot>
  setLaunchAtLogin(enabled: boolean): Promise<SettingsSnapshot>
  suspendHotkeys(suspended: boolean): void
  openFolder(kind: FolderKind): void
  onChange(listener: (snapshot: SettingsSnapshot) => void): () => void
}
