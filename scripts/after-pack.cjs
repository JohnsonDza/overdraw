// electron-builder afterPack hook. OPT-IN: set OVERDRAW_CODEC_FREE_FFMPEG=1.
//
// Electron's default ffmpeg.dll includes patent-encumbered codecs (H.264, AAC).
// Overdraw plays no audio or video, so a commercial release may prefer the
// codec-free ffmpeg build that Electron publishes with every release.
//
// It is off by default because Smart App Control blocks that DLL: unlike
// Electron's default one, it has no reputation with Microsoft, and every
// renderer loads ffmpeg.dll, so no Overdraw window can open. Only turn it on
// for builds whose DLLs are code-signed (electron-builder `win.signDlls`).
//
// The download is verified against a hash pinned below. When upgrading
// Electron, add the new version's hash from the release's SHASUMS256.txt.
const { createHash } = require('node:crypto')
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { inflateRawSync } = require('node:zlib')

const FFMPEG_SHA256 = {
  '44.9.3/win32-x64': '99ab7ca87d50bf009f26bce8e60619f3df79176dcb2d091a9239eceec4febf3f'
}

/** Extracts one file from a zip archive (stored or deflated entries). */
function unzipEntry(zip, wanted) {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (eocd < 0) throw new Error('Not a zip file')
  const count = zip.readUInt16LE(eocd + 10)
  let p = zip.readUInt32LE(eocd + 16)
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(p + 10)
    const size = zip.readUInt32LE(p + 20)
    const nameLen = zip.readUInt16LE(p + 28)
    const extraLen = zip.readUInt16LE(p + 30)
    const commentLen = zip.readUInt16LE(p + 32)
    const local = zip.readUInt32LE(p + 42)
    const name = zip.toString('utf8', p + 46, p + 46 + nameLen)
    if (name === wanted) {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
      const data = zip.subarray(start, start + size)
      if (method === 0) return data
      if (method === 8) return inflateRawSync(data)
      throw new Error(`Unsupported zip compression method ${method}`)
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  throw new Error(`${wanted} not found in archive`)
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return
  if (process.env.OVERDRAW_CODEC_FREE_FFMPEG !== '1') {
    console.log("  • keeping Electron's default ffmpeg.dll (set OVERDRAW_CODEC_FREE_FFMPEG=1 to swap)")
    return
  }
  const version = require('electron/package.json').version
  const arch = { 1: 'x64', 3: 'arm64', 0: 'ia32' }[context.arch] ?? 'x64'
  const key = `${version}/win32-${arch}`
  const expected = FFMPEG_SHA256[key]
  if (!expected) {
    throw new Error(`No pinned ffmpeg hash for Electron ${key}. Add it to scripts/after-pack.cjs from SHASUMS256.txt.`)
  }

  const cacheDir = join(__dirname, '..', 'node_modules', '.cache', 'overdraw')
  const zipPath = join(cacheDir, `ffmpeg-v${version}-win32-${arch}.zip`)
  if (!existsSync(zipPath)) {
    const url = `https://github.com/electron/electron/releases/download/v${version}/ffmpeg-v${version}-win32-${arch}.zip`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`)
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()))
  }

  const zip = readFileSync(zipPath)
  const actual = createHash('sha256').update(zip).digest('hex')
  if (actual !== expected) throw new Error(`ffmpeg zip hash mismatch for ${key}: ${actual}`)

  writeFileSync(join(context.appOutDir, 'ffmpeg.dll'), unzipEntry(zip, 'ffmpeg.dll'))
  console.log(`  • replaced ffmpeg.dll with Electron's codec-free build (${key})`)
}
