import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Plugin } from 'vite'

/**
 * Fonts copied from Excalidraw by scripts/copy-assets.mjs. Excalidraw's npm
 * package ships them without licence files, so the notices are recorded here
 * (copyright lines taken from each font's own name table and upstream repo).
 */
const FONT_NOTICES = [
  { name: 'Excalifont', copyright: 'Copyright (c) 2024 by Excalidraw', licence: 'OFL-1.1', source: 'https://plus.excalidraw.com/excalifont' },
  { name: 'Virgil', copyright: 'Copyright (c) 2021 - Present, Ellinor Rapp, with Reserved Font Name Virgil', licence: 'OFL-1.1', source: 'https://github.com/excalidraw/virgil' },
  { name: 'Xiaolai SC', copyright: 'Copyright 2020-2024 LXGW (https://github.com/lxgw/kose-font)\nCopyright 2014 Nozomi Seto (https://ja.osdn.net/projects/setofont/)', licence: 'OFL-1.1', source: 'https://github.com/lxgw/kose-font' },
  { name: 'Nunito', copyright: 'Copyright 2014 The Nunito Project Authors (https://github.com/googlefonts/nunito)', licence: 'OFL-1.1', source: 'https://github.com/googlefonts/nunito' },
  { name: 'Lilita One', copyright: 'Copyright (c) 2011 Juan Montoreano (juan@remolacha.biz), with Reserved Font Name Lilita', licence: 'OFL-1.1', source: 'https://github.com/google/fonts/tree/main/ofl/lilitaone' },
  { name: 'Assistant', copyright: "Copyright 2020 The Assistant Project Authors (https://github.com/hafontia/Assistant)\nCopyright 2010 The Source Sans Pro Authors (https://github.com/adobe-fonts/source-sans-pro), with Reserved Font Name 'Source'", licence: 'OFL-1.1', source: 'https://github.com/hafontia/Assistant' },
  { name: 'Cascadia Code', copyright: 'Copyright (c) 2019 - Present, Microsoft Corporation, with Reserved Font Name Cascadia Code', licence: 'OFL-1.1', source: 'https://github.com/microsoft/cascadia-code' },
  { name: 'Comic Shanns', copyright: 'Copyright (c) 2018 Shannon Miwa\nCopyright (c) 2023 Jesus Gonzalez\nCopyright (c) 2023 Rodrigo Batista de Moraes', licence: 'MIT', source: 'https://github.com/shannpersand/comic-shanns' }
]

const MIT_TEMPLATE = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

/** Licences that may ship inside a closed-source, paid app without extra conditions. */
const PERMISSIVE = new Set(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'Unlicense', 'CC0-1.0', 'Zlib', 'Python-2.0', 'BlueOak-1.0.0'])

/** SPDX expression check: "A OR B" needs one permissive option, "A AND B" needs all. */
function isPermissive(expression: string): boolean {
  const flat = expression.replace(/[()]/g, ' ').trim()
  if (/\sOR\s/.test(flat)) return flat.split(/\s+OR\s+/).some(isPermissive)
  return flat.split(/\s+AND\s+/).every((id) => PERMISSIVE.has(id.trim()))
}

interface PackageNotice {
  name: string
  version: string
  licence: string
  text: string
}

function packageRoot(id: string): string | null {
  const clean = id.replace(/^\0/, '').split('?')[0].replace(/\\/g, '/')
  const marker = '/node_modules/'
  const at = clean.lastIndexOf(marker)
  if (at === -1) return null
  const rest = clean.slice(at + marker.length).split('/')
  const nameParts = rest[0].startsWith('@') ? 2 : 1
  return clean.slice(0, at + marker.length) + rest.slice(0, nameParts).join('/')
}

function readNotice(root: string): PackageNotice | null {
  const pkgFile = join(root, 'package.json')
  if (!existsSync(pkgFile)) return null
  const pkg = JSON.parse(readFileSync(pkgFile, 'utf8')) as {
    name: string
    version: string
    license?: string | { type: string }
    licenses?: { type: string }[] // legacy package.json form
    author?: string | { name: string }
  }
  const file = readdirSync(root).find((f) => /^(licen[cs]e|copying)([-.][\w.]+)?$/i.test(f))
  let text = file ? readFileSync(join(root, file), 'utf8').trim() : ''
  let licence =
    (typeof pkg.license === 'string' ? pkg.license : pkg.license?.type) ??
    pkg.licenses?.map((l) => l.type).join(' OR ') ??
    'UNKNOWN'
  // Some packages only state their licence in the file itself.
  if (licence === 'UNKNOWN' && /permission is hereby granted, free of charge/i.test(text)) licence = 'MIT'
  if (!text && licence === 'MIT') {
    // A few packages declare MIT but ship no LICENSE file; use the standard text.
    const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name
    text = `MIT License\n\nCopyright (c) ${author ?? `the ${pkg.name} authors`}\n\n${MIT_TEMPLATE}`
  }
  return { name: pkg.name, version: pkg.version, licence, text }
}

/**
 * Writes THIRD_PARTY_NOTICES.txt listing every npm package that ends up in the
 * renderer bundle, with its licence text, plus the bundled fonts. The build
 * fails if a package is under a licence not on the permissive allow-list, so
 * a copyleft dependency can never slip into a paid release unnoticed.
 */
export function thirdPartyNotices(options: { output: string; oflText: string }): Plugin {
  return {
    name: 'overdraw:third-party-notices',
    apply: 'build',
    generateBundle() {
      const roots = new Set<string>()
      for (const id of this.getModuleIds()) {
        const root = packageRoot(id)
        if (root) roots.add(root)
      }
      const notices = [...roots]
        .map(readNotice)
        .filter((n): n is PackageNotice => n !== null)
        .sort((a, b) => a.name.localeCompare(b.name))

      const disallowed = notices.filter((n) => !isPermissive(n.licence))
      if (disallowed.length) {
        this.error(`Bundled packages with non-permissive licences:\n${disallowed.map((n) => `  ${n.name}@${n.version}: ${n.licence}`).join('\n')}`)
      }

      const rule = '='.repeat(78)
      const parts = [
        'OVERDRAW — THIRD-PARTY NOTICES',
        '',
        'Overdraw itself is free and open source under the MIT License (LICENSE.txt).',
        'It includes the following third-party software and fonts. Each is used',
        'under the licence reproduced below.',
        '',
        'The Electron runtime (including Chromium) is covered by LICENSE.electron.txt',
        'and LICENSES.chromium.html, shipped next to Overdraw.exe.',
        '',
        `${rule}\nFONTS\n${rule}`,
        ...FONT_NOTICES.map((f) => `${f.name} (${f.licence}) — ${f.source}\n${f.copyright}`),
        '',
        `The fonts marked OFL-1.1 are licensed under the SIL Open Font License 1.1:\n\n${options.oflText.trim()}`,
        '',
        `Comic Shanns is licensed under the MIT License:\n\n${MIT_TEMPLATE}`,
        '',
        `${rule}\nSOFTWARE (${notices.length} packages)\n${rule}`,
        ...notices.map((n) => `${'-'.repeat(78)}\n${n.name}@${n.version} — ${n.licence}\n${'-'.repeat(78)}\n${n.text || '(No licence text shipped with this package.)'}`)
      ]
      mkdirSync(dirname(options.output), { recursive: true })
      writeFileSync(options.output, parts.join('\n\n') + '\n', 'utf8')
      this.info(`Wrote ${notices.length} package notices to ${options.output}`)
    }
  }
}
