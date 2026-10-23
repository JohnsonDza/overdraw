import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { OverlayBridge } from '@shared/bridge'
import type { IPC, OverlayCommand } from '@shared/ipc'

// Type-only imports keep this file free of shared runtime code (see
// electron.vite.config.ts); `satisfies` keeps the names in sync with IPC.
const channel = {
  overlayInit: 'overlay:init',
  overlayCommand: 'overlay:command',
  overlayRequestMode: 'overlay:request-mode',
  overlayReport: 'overlay:report',
  overlayCaptureReady: 'overlay:capture-ready',
  overlayScreenshot: 'overlay:screenshot',
  overlayOpenSettings: 'overlay:open-settings'
} as const satisfies Partial<typeof IPC>

/**
 * The only surface the overlay page can reach. Each method maps to one
 * channel; raw ipcRenderer is never exposed.
 */
const api: OverlayBridge = {
  init: () => ipcRenderer.invoke(channel.overlayInit),

  onCommand(listener) {
    const handler = (_event: IpcRendererEvent, command: OverlayCommand): void => listener(command)
    ipcRenderer.on(channel.overlayCommand, handler)
    return () => ipcRenderer.off(channel.overlayCommand, handler)
  },

  requestMode: (mode) => ipcRenderer.send(channel.overlayRequestMode, mode),
  report: (report) => ipcRenderer.send(channel.overlayReport, report),
  captureReady: (id) => ipcRenderer.send(channel.overlayCaptureReady, id),
  screenshot: () => ipcRenderer.send(channel.overlayScreenshot),
  openSettings: () => ipcRenderer.send(channel.overlayOpenSettings)
}

contextBridge.exposeInMainWorld('overdraw', api)
