import { release } from 'node:os'
import { app, BrowserWindow, nativeTheme } from 'electron'
import { iconPath, pageUrl, preloadPath } from './paths'

let current: BrowserWindow | null = null

export function getSettingsWindow(): BrowserWindow | null {
  return current && !current.isDestroyed() ? current : null
}

export function openSettingsWindow(onClosed: () => void): BrowserWindow {
  const existing = getSettingsWindow()
  if (existing) {
    if (existing.isMinimized()) existing.restore()
    existing.show()
    existing.focus()
    return existing
  }

  const dark = nativeTheme.shouldUseDarkColors
  const mica = supportsMica()
  const win = new BrowserWindow({
    width: 560,
    height: 680,
    minWidth: 480,
    minHeight: 520,
    show: false,
    title: 'Overdraw Settings',
    icon: iconPath('icon.png'),
    autoHideMenuBar: true,
    // Native Windows 11 material and caption buttons, content drawn edge to edge.
    backgroundMaterial: mica ? 'mica' : 'none',
    backgroundColor: mica ? '#00000000' : dark ? '#1c1c1e' : '#f5f5f7',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: dark ? '#f5f5f7' : '#1d1d1f',
      height: 44
    },
    webPreferences: {
      preload: preloadPath('settings'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      devTools: !app.isPackaged
    }
  })
  win.removeMenu()
  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
    current = null
    onClosed()
  })
  nativeTheme.on('updated', function updateCaption() {
    if (win.isDestroyed()) return nativeTheme.off('updated', updateCaption)
    win.setTitleBarOverlay({ symbolColor: nativeTheme.shouldUseDarkColors ? '#f5f5f7' : '#1d1d1f' })
  })
  void win.loadURL(pageUrl('settings') + (mica ? '#mica' : ''))
  current = win
  return win
}

/** Mica backdrops need Windows 11 22H2 (build 22621) or later. */
function supportsMica(): boolean {
  if (process.platform !== 'win32') return false
  const build = Number(release().split('.')[2])
  return Number.isFinite(build) && build >= 22621
}
