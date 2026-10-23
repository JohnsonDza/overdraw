/// <reference types="vite/client" />
import type { OverlayBridge, SettingsBridge } from '@shared/bridge'

declare global {
  interface Window {
    overdraw?: OverlayBridge
    overdrawSettings?: SettingsBridge
    /** Where Excalidraw loads its fonts from; set to our own origin. */
    EXCALIDRAW_ASSET_PATH?: string | string[]
  }
}

export {}
