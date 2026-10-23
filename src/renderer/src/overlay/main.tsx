import './asset-path'
import '@excalidraw/excalidraw/index.css'
import '../design/tokens.css'
import './overlay.css'
import { createRoot } from 'react-dom/client'
import { OverlayApp } from './OverlayApp'
import { createPreviewBridge } from './preview-bridge'

async function boot(): Promise<void> {
  const bridge = window.overdraw ?? (import.meta.env.DEV ? createPreviewBridge() : undefined)
  if (!bridge) throw new Error('Overdraw bridge is unavailable.')
  const init = await bridge.init()
  createRoot(document.getElementById('root')!).render(<OverlayApp bridge={bridge} init={init} />)
}

void boot()
