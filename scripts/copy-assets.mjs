// Copies Excalidraw's fonts next to the renderer so the app never loads them
// from a CDN. Runs before every dev and production build.
import { cpSync, existsSync, rmSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'node_modules/@excalidraw/excalidraw/dist/prod/fonts')
const target = join(root, 'src/renderer/public/fonts')

// Liberation Sans in this package is the 1.x release, licensed under GPLv2 with
// a font exception rather than the OFL. Excalidraw only uses it for legacy
// "Helvetica" text; without it Windows falls back to the metric-compatible
// Arial, so it is left out to keep the app's licensing simple.
// Fonts that are shipped are listed in scripts/notices-plugin.ts.
const EXCLUDED = new Set(['Liberation'])

if (!existsSync(source)) {
  console.error('Excalidraw fonts not found. Run `npm install` first.')
  process.exit(1)
}
rmSync(target, { recursive: true, force: true })
cpSync(source, target, {
  recursive: true,
  filter: (path) => !EXCLUDED.has(basename(path))
})
console.log('Copied Excalidraw fonts to src/renderer/public/fonts')
