// Fails the build if a preload bundle requires anything but 'electron'.
// Sandboxed preloads cannot load other files, so a stray shared chunk would
// only show up at runtime as a blank, unresponsive overlay.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), '../out/preload')
const problems = []
for (const entry of readdirSync(dir, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    problems.push(`${entry.name}/ (shared chunks are not allowed)`)
    continue
  }
  const source = readFileSync(join(dir, entry.name), 'utf8')
  for (const [, mod] of source.matchAll(/require\(["']([^"']+)["']\)/g)) {
    if (mod !== 'electron') problems.push(`${entry.name} requires "${mod}"`)
  }
}
if (problems.length) {
  console.error('Preload bundles must be self-contained:\n  ' + problems.join('\n  '))
  process.exit(1)
}
console.log('Preload bundles are self-contained.')
