import { globalShortcut } from 'electron'
import type { HotkeyStatus } from '@shared/ipc'
import { HOTKEY_ACTIONS, type HotkeyAction, type Hotkeys } from '@shared/settings'

type Handlers = Record<HotkeyAction, () => void>

/**
 * Owns every global shortcut. Registration can fail when another app already
 * holds a combination; that is reported per action rather than thrown.
 */
export class HotkeyManager {
  private status = {} as Record<HotkeyAction, HotkeyStatus>
  private hotkeys: Hotkeys | null = null
  private suspended = false

  constructor(private readonly handlers: Handlers) {}

  apply(hotkeys: Hotkeys): Record<HotkeyAction, HotkeyStatus> {
    this.hotkeys = hotkeys
    if (!this.suspended) this.registerAll()
    return this.getStatus()
  }

  /**
   * While the settings window records a new shortcut, our own shortcuts must
   * be released, otherwise Windows delivers the keystroke to us instead.
   */
  setSuspended(suspended: boolean): void {
    if (suspended === this.suspended) return
    this.suspended = suspended
    if (suspended) globalShortcut.unregisterAll()
    else this.registerAll()
  }

  getStatus(): Record<HotkeyAction, HotkeyStatus> {
    return { ...this.status }
  }

  dispose(): void {
    globalShortcut.unregisterAll()
  }

  private registerAll(): void {
    globalShortcut.unregisterAll()
    if (!this.hotkeys) return
    const used = new Set<string>()
    for (const action of HOTKEY_ACTIONS) {
      const accelerator = this.hotkeys[action]
      if (!accelerator) {
        this.status[action] = 'off'
        continue
      }
      if (used.has(accelerator)) {
        this.status[action] = 'conflict'
        continue
      }
      let ok = false
      try {
        ok = globalShortcut.register(accelerator, this.handlers[action])
      } catch {
        ok = false
      }
      this.status[action] = ok ? 'ok' : 'conflict'
      if (ok) used.add(accelerator)
    }
  }
}
