import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { SettingsBridge } from '@shared/bridge'
import type { IPC, SettingsSnapshot } from '@shared/ipc'

// Type-only imports keep this file free of shared runtime code (see
// electron.vite.config.ts); `satisfies` keeps the names in sync with IPC.
const channel = {
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  settingsReset: 'settings:reset',
  settingsSetLaunchAtLogin: 'settings:set-launch-at-login',
  settingsSuspendHotkeys: 'settings:suspend-hotkeys',
  settingsOpenFolder: 'settings:open-folder',
  settingsChanged: 'settings:changed'
} as const satisfies Partial<typeof IPC>

const api: SettingsBridge = {
  get: () => ipcRenderer.invoke(channel.settingsGet),
  update: (patch) => ipcRenderer.invoke(channel.settingsUpdate, patch),
  reset: () => ipcRenderer.invoke(channel.settingsReset),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke(channel.settingsSetLaunchAtLogin, enabled),
  suspendHotkeys: (suspended) => ipcRenderer.send(channel.settingsSuspendHotkeys, suspended),
  openFolder: (kind) => ipcRenderer.send(channel.settingsOpenFolder, kind),

  onChange(listener) {
    const handler = (_event: IpcRendererEvent, snapshot: SettingsSnapshot): void => listener(snapshot)
    ipcRenderer.on(channel.settingsChanged, handler)
    return () => ipcRenderer.off(channel.settingsChanged, handler)
  }
}

contextBridge.exposeInMainWorld('overdrawSettings', api)
