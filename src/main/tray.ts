import { Menu, nativeImage, nativeTheme, Tray, type MenuItemConstructorOptions } from 'electron'
import type { Settings } from '@shared/settings'
import { iconPath } from './paths'

export interface TrayState {
  drawing: boolean
  inkVisible: boolean
  hasInk: boolean
  settings: Settings
  launchAtLogin: boolean
  launchAtLoginAvailable: boolean
}

export interface TrayActions {
  toggleDraw: () => void
  toggleVisibility: () => void
  clearAll: () => void
  screenshot: () => void
  openScreenshots: () => void
  openSettings: () => void
  setLaunchAtLogin: (enabled: boolean) => void
  quit: () => void
}

/** Menu accelerators are shown as hints only; the real shortcuts are global. */
const hint = (accelerator: string): Partial<MenuItemConstructorOptions> =>
  accelerator ? { accelerator, registerAccelerator: false } : {}

export class AppTray {
  private tray: Tray
  private state: TrayState | null = null

  constructor(private readonly actions: TrayActions) {
    this.tray = new Tray(this.icon())
    this.tray.setToolTip('Overdraw')
    // Left click is the fastest path to drawing; right click opens the menu.
    this.tray.on('click', () => actions.toggleDraw())
    nativeTheme.on('updated', () => this.tray.setImage(this.icon()))
  }

  update(state: TrayState): void {
    this.state = state
    const { hotkeys } = state.settings
    const shortcut = hotkeys.toggleDraw ? ` (${hotkeys.toggleDraw})` : ''
    this.tray.setToolTip(state.drawing ? 'Overdraw: drawing' : `Overdraw: click to draw${shortcut}`)
    this.tray.setContextMenu(Menu.buildFromTemplate(this.template()))
  }

  destroy(): void {
    this.tray.destroy()
  }

  /** Windows taskbar can be dark while apps are light (and vice versa). */
  private icon(): Electron.NativeImage {
    const dark = nativeTheme.shouldUseDarkColorsForSystemIntegratedUI
    return nativeImage.createFromPath(iconPath(dark ? 'tray-dark.png' : 'tray-light.png'))
  }

  private template(): MenuItemConstructorOptions[] {
    const s = this.state
    if (!s) return []
    const { hotkeys } = s.settings
    const a = this.actions
    return [
      { label: s.drawing ? 'Stop Drawing' : 'Start Drawing', click: a.toggleDraw, ...hint(hotkeys.toggleDraw) },
      {
        label: s.inkVisible ? 'Hide Ink' : 'Show Ink',
        enabled: s.hasInk,
        click: a.toggleVisibility,
        ...hint(hotkeys.toggleVisibility)
      },
      { label: 'Clear All Screens', enabled: s.hasInk, click: a.clearAll },
      { label: 'Take Screenshot', click: a.screenshot, ...hint(hotkeys.screenshot) },
      { type: 'separator' },
      { label: 'Open Screenshots Folder', click: a.openScreenshots },
      { label: 'Settings…', click: a.openSettings },
      {
        label: 'Launch at Login',
        type: 'checkbox',
        checked: s.launchAtLogin,
        enabled: s.launchAtLoginAvailable,
        click: (item) => a.setLaunchAtLogin(item.checked)
      },
      { type: 'separator' },
      { label: 'Quit Overdraw', click: a.quit }
    ]
  }
}
