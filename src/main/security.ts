import { extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, net, protocol, session, shell, type WebContents } from 'electron'
import { APP_HOST, APP_SCHEME, DEV_SERVER_URL, isTrustedUrl, rendererRoot } from './paths'

/**
 * Content Security Policy for every page we serve.
 * - Excalidraw injects inline styles, hence 'unsafe-inline' for styles only.
 * - Font subsetting (used when exporting) runs WebAssembly in a module worker.
 * - Nothing may be loaded from the network; the app works fully offline.
 */
const PRODUCTION_CSP = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "connect-src 'self' data: blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ')

// The Vite dev server needs inline scripts (React Refresh) and a websocket (HMR).
const DEV_CSP = PRODUCTION_CSP.replace(
  "script-src 'self' 'wasm-unsafe-eval'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'"
).replace("connect-src 'self' data: blob:", "connect-src 'self' data: blob: ws://localhost:* http://localhost:*")

/** Explicit types, since responses are sent with `nosniff`. */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
}

/** Permissions the editor legitimately needs (copy/paste, Save/Open dialogs). */
const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write', 'clipboard-read', 'fileSystem'])

/** Must run before `app.ready`. */
export function registerPrivilegedScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, codeCache: true }
    }
  ])
}

/**
 * Serves the built renderer from `app://overdraw/…`. A custom scheme instead
 * of file:// means pages cannot read arbitrary files on disk, and every path
 * is checked to stay inside the renderer folder.
 */
export function registerAppProtocol(): void {
  const root = resolve(rendererRoot())
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url)
    if (url.host !== APP_HOST || request.method !== 'GET') {
      return new Response('Not found', { status: 404 })
    }
    let pathname: string
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      return new Response('Bad request', { status: 400 })
    }
    const file = resolve(root, `.${pathname}`)
    const rel = relative(root, file)
    if (rel === '' || rel.split(sep).includes('..') || isAbsolute(rel)) {
      return new Response('Not found', { status: 404 })
    }

    let response: Response
    try {
      response = await net.fetch(pathToFileURL(file).toString())
    } catch {
      return new Response('Not found', { status: 404 })
    }
    if (!response.ok) return new Response('Not found', { status: 404 })

    const headers = new Headers(response.headers)
    const type = MIME_TYPES[extname(file).toLowerCase()]
    if (type) headers.set('Content-Type', type)
    headers.set('X-Content-Type-Options', 'nosniff')
    if (extname(file) === '.html') {
      headers.set('Content-Security-Policy', PRODUCTION_CSP)
      headers.set('Cache-Control', 'no-store')
    }
    return new Response(response.body, { status: 200, headers })
  })
}

function openExternalSafely(raw: string): void {
  try {
    const url = new URL(raw)
    if (url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:') {
      void shell.openExternal(url.toString())
    }
  } catch {
    // Ignore malformed URLs.
  }
}

function hardenWebContents(contents: WebContents): void {
  // Links (Excalidraw help, element hyperlinks) open in the user's browser, never in-app.
  contents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event, url) => {
    if (!isTrustedUrl(url)) event.preventDefault()
  })
  contents.on('will-redirect', (event, url) => {
    if (!isTrustedUrl(url)) event.preventDefault()
  })
  contents.on('will-attach-webview', (event) => event.preventDefault())
}

/** Must run after `app.ready`. */
export function applySessionSecurity(): void {
  const ses = session.defaultSession

  ses.setPermissionRequestHandler((contents, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission) && isTrustedUrl(contents.getURL()))
  })
  ses.setPermissionCheckHandler((_contents, permission, requestingOrigin) => {
    return ALLOWED_PERMISSIONS.has(permission) && isTrustedUrl(requestingOrigin)
  })
  // No camera, microphone or screen sharing from any renderer.
  ses.setDisplayMediaRequestHandler((_request, callback) => callback({}))
  ses.setDevicePermissionHandler(() => false)

  if (DEV_SERVER_URL) {
    ses.webRequest.onHeadersReceived({ urls: [`${DEV_SERVER_URL}/*`] }, (details, callback) => {
      const headers = { ...details.responseHeaders, 'Content-Security-Policy': [DEV_CSP] }
      callback({ responseHeaders: headers })
    })
  }

  app.on('web-contents-created', (_event, contents) => hardenWebContents(contents))
}
