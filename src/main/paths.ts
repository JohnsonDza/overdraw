import { dirname, join } from 'node:path'
import { app } from 'electron'

/** Origin that serves the bundled renderer in production. */
export const APP_SCHEME = 'app'
export const APP_HOST = 'overdraw'
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`

/** Vite dev server URL, injected by electron-vite only during `npm run dev`. */
export const DEV_SERVER_URL = app.isPackaged ? undefined : process.env['ELECTRON_RENDERER_URL']

export const rendererRoot = (): string => join(__dirname, '../renderer')

export const preloadPath = (name: 'overlay' | 'settings'): string =>
  join(__dirname, `../preload/${name}.js`)

export const iconPath = (file: string): string =>
  app.isPackaged
    ? join(process.resourcesPath, 'icons', file)
    : join(app.getAppPath(), 'resources', file)

export function pageUrl(page: 'overlay' | 'settings'): string {
  return DEV_SERVER_URL ? `${DEV_SERVER_URL}/${page}.html` : `${APP_ORIGIN}/${page}.html`
}

/** True when a URL belongs to our own renderer (prod protocol or dev server). */
export function isTrustedUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    // Node's URL reports origin "null" for custom schemes, so compare parts.
    if (url.protocol === `${APP_SCHEME}:` && url.host === APP_HOST) return true
    return DEV_SERVER_URL !== undefined && url.origin === new URL(DEV_SERVER_URL).origin
  } catch {
    return false
  }
}

export const screenshotFolder = (): string => join(app.getPath('pictures'), 'Overdraw')

/** Generated at build time; shipped next to Overdraw.exe (see electron-builder.yml). */
export const noticesPath = (): string =>
  app.isPackaged
    ? join(dirname(process.execPath), 'THIRD_PARTY_NOTICES.txt')
    : join(app.getAppPath(), 'out', 'THIRD_PARTY_NOTICES.txt')
