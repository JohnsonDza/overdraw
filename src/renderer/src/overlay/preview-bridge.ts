import type { OverlayBridge } from '@shared/bridge'
import type { OverlayCommand } from '@shared/ipc'
import { DEFAULT_SETTINGS } from '@shared/settings'

/**
 * Stand-in for the Electron bridge so the overlay can be developed and tested
 * in a normal browser tab (`npx vite src/renderer`). Never used in the app.
 */
export function createPreviewBridge(): OverlayBridge {
  const listeners = new Set<(command: OverlayCommand) => void>()
  const emit = (command: OverlayCommand): void => listeners.forEach((l) => l(command))
  const log = (...args: unknown[]): void => console.info('[preview bridge]', ...args)

  return {
    init: async () => ({ mode: 'drawing', settings: { ...DEFAULT_SETTINGS }, theme: 'light' }),
    onCommand(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    requestMode(mode) {
      log('requestMode', mode)
      emit({ type: 'mode', mode })
      if (mode !== 'drawing') setTimeout(() => emit({ type: 'mode', mode: 'drawing' }), 1500)
    },
    report: (report) => log('report', report),
    captureReady: (id) => log('captureReady', id),
    screenshot() {
      log('screenshot')
      emit({ type: 'prepare-capture', id: 1 })
      setTimeout(() => emit({ type: 'end-capture' }), 800)
    },
    openSettings: () => log('openSettings')
  }
}
