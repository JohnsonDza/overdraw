// Generates the app icon and tray icons from code. The brush stroke is drawn
// with perfect-freehand (the same stroke engine Excalidraw's pen uses), then
// rasterised with an anti-aliased scanline fill and written as PNG.
//
//   npm run icons
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'
import { getStroke } from 'perfect-freehand'

const out = join(dirname(fileURLToPath(import.meta.url)), '../resources')
mkdirSync(out, { recursive: true })

// ── Geometry ──────────────────────────────────────────────────────────────

/**
 * A single cursive loop (a prolate cycloid), fitted into the unit box
 * [0.18, 0.82] horizontally and centred vertically, with pen pressure.
 */
function loopPoints() {
  const raw = []
  const n = 240
  const from = Math.PI * 0.75
  const to = Math.PI * 2.75
  for (let i = 0; i <= n; i++) {
    const t = from + ((to - from) * i) / n
    const x = 0.3 * t - Math.sin(t)
    const y = -Math.cos(t) * 0.8 - 0.1 * t
    const pressure = 0.3 + 0.7 * Math.sin((i / n) * Math.PI) ** 0.6
    raw.push([x, y, pressure])
  }
  const xs = raw.map((p) => p[0])
  const ys = raw.map((p) => p[1])
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const k = 0.64 / (maxX - minX)
  const cy = (minY + maxY) / 2
  return raw.map(([x, y, p]) => [0.18 + (x - minX) * k, 0.5 + (y - cy) * k, p])
}

/**
 * perfect-freehand returns a sparse outline meant to be drawn as quadratic
 * curves through edge midpoints (see its README's getSvgPathFromStroke).
 * Flatten those curves into a dense polygon so the raster is smooth.
 */
function smoothOutline(outline, steps = 10) {
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const result = []
  const n = outline.length
  for (let i = 0; i < n; i++) {
    const p0 = mid(outline[(i - 1 + n) % n], outline[i])
    const c = outline[i]
    const p1 = mid(outline[i], outline[(i + 1) % n])
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      const u = 1 - t
      result.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]])
    }
  }
  return result
}

function strokeOutline(size, scale) {
  const pts = loopPoints().map(([x, y, p]) => [x * scale, y * scale, p])
  return smoothOutline(
    getStroke(pts, {
      size,
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.3,
      simulatePressure: false,
      last: true,
      start: { taper: size * 2, cap: true },
      end: { taper: size * 4, cap: true }
    })
  )
}

// ── Raster ────────────────────────────────────────────────────────────────

const SS = 4 // 4×4 supersampling per pixel

/** Coverage (0..1) of a polygon, non-zero winding, via subsampled scanlines. */
function polygonCoverage(poly, w, h, offset = [0, 0]) {
  const cov = new Float32Array(w * h)
  const edges = poly.map((p, i) => [p, poly[(i + 1) % poly.length]])
  const unit = 1 / (SS * SS)
  for (let sy = 0; sy < h * SS; sy++) {
    const y = (sy + 0.5) / SS - offset[1]
    const hits = []
    for (const [a, b] of edges) {
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        const x = a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]) + offset[0]
        hits.push([x, b[1] > a[1] ? 1 : -1])
      }
    }
    hits.sort((p, q) => p[0] - q[0])
    let winding = 0
    const row = Math.floor(sy / SS) * w
    for (let i = 0; i < hits.length - 1; i++) {
      winding += hits[i][1]
      if (winding === 0) continue
      const from = Math.max(0, Math.ceil(hits[i][0] * SS - 0.5))
      const to = Math.min(w * SS - 1, Math.floor(hits[i + 1][0] * SS - 0.5))
      for (let sx = from; sx <= to; sx++) cov[row + Math.floor(sx / SS)] += unit
    }
  }
  return cov
}

/** Coverage of an Apple-style squircle (superellipse) filling `inset`..`size-inset`. */
function squircleCoverage(size, inset, exponent = 5) {
  const cov = new Float32Array(size * size)
  const r = (size - inset * 2) / 2
  const c = size / 2
  const unit = 1 / (SS * SS)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hits = 0
      for (let j = 0; j < SS; j++) {
        for (let i = 0; i < SS; i++) {
          const x = Math.abs((px + (i + 0.5) / SS - c) / r)
          const y = Math.abs((py + (j + 0.5) / SS - c) / r)
          if (x ** exponent + y ** exponent <= 1) hits++
        }
      }
      cov[py * size + px] = hits * unit
    }
  }
  return cov
}

class Image {
  constructor(w, h) {
    this.w = w
    this.h = h
    this.px = new Float32Array(w * h * 4) // premultiplied RGBA, 0..1
  }
  /** Composite `color(x, y)` through a coverage mask (source-over). */
  fill(coverage, color) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x
        const a = Math.min(1, coverage[i])
        if (a <= 0) continue
        const [r, g, b, ca = 1] = color(x / this.w, y / this.h)
        const alpha = a * ca
        const o = i * 4
        this.px[o] = r * alpha + this.px[o] * (1 - alpha)
        this.px[o + 1] = g * alpha + this.px[o + 1] * (1 - alpha)
        this.px[o + 2] = b * alpha + this.px[o + 2] * (1 - alpha)
        this.px[o + 3] = alpha + this.px[o + 3] * (1 - alpha)
      }
    }
  }
  png() {
    const raw = Buffer.alloc((this.w * 4 + 1) * this.h)
    for (let y = 0; y < this.h; y++) {
      raw[y * (this.w * 4 + 1)] = 0
      for (let x = 0; x < this.w; x++) {
        const o = (y * this.w + x) * 4
        const a = this.px[o + 3]
        const d = y * (this.w * 4 + 1) + 1 + x * 4
        // Un-premultiply for PNG's straight alpha.
        raw[d] = a ? Math.round((this.px[o] / a) * 255) : 0
        raw[d + 1] = a ? Math.round((this.px[o + 1] / a) * 255) : 0
        raw[d + 2] = a ? Math.round((this.px[o + 2] / a) * 255) : 0
        raw[d + 3] = Math.round(a * 255)
      }
    }
    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(this.w, 0)
    ihdr.writeUInt32BE(this.h, 4)
    ihdr.set([8, 6, 0, 0, 0], 8)
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0))
    ])
  }
}

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)

// ── App icon ──────────────────────────────────────────────────────────────

function appIcon(size) {
  const img = new Image(size, size)
  const inset = size * 0.06
  const top = hex('#2c2c2e')
  const bottom = hex('#111113')
  img.fill(squircleCoverage(size, inset), (_x, y) => mix(top, bottom, y))
  // Hairline highlight along the top edge, like macOS app icons.
  const rim = squircleCoverage(size, inset)
  const innerRim = squircleCoverage(size, inset + Math.max(1, size * 0.006))
  img.fill(rim.map((v, i) => Math.max(0, v - innerRim[i])), (_x, y) => [1, 1, 1, 0.18 * (1 - y)])

  const red = hex('#ff3b30')
  const orange = hex('#ff9f0a')
  const outline = strokeOutline(size * 0.075, size)
  img.fill(polygonCoverage(outline, size, size), (x) => mix(red, orange, Math.min(1, Math.max(0, (x - 0.2) / 0.6))))
  return img
}

// ── Tray glyph: the same stroke, monochrome, sized for the notification area ──

function trayIcon(size, color) {
  const img = new Image(size, size)
  // Tray icons have no backplate: fit the stroke's real bounds into the
  // square with a hairline margin, keeping its aspect ratio.
  // perfect-freehand thresholds are in pixels, so build at full scale, then normalise.
  const unit = strokeOutline(48, 512)
  const xs = unit.map((p) => p[0])
  const ys = unit.map((p) => p[1])
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const margin = size * 0.04
  const k = (size - margin * 2) / Math.max(maxX - minX, maxY - minY)
  const dx = margin + (size - margin * 2 - (maxX - minX) * k) / 2
  const dy = margin + (size - margin * 2 - (maxY - minY) * k) / 2
  const outline = unit.map(([x, y]) => [(x - minX) * k + dx, (y - minY) * k + dy])
  img.fill(polygonCoverage(outline, size, size), () => color)
  return img
}

writeFileSync(join(out, 'icon.png'), appIcon(512).png())

/** Windows .ico holding PNG-compressed images (supported since Windows Vista). */
function ico(sizes) {
  const images = sizes.map((s) => appIcon(s).png())
  const header = Buffer.alloc(6 + 16 * sizes.length)
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(sizes.length, 4)
  let offset = header.length
  sizes.forEach((size, i) => {
    const e = 6 + i * 16
    header[e] = size >= 256 ? 0 : size // 0 means 256
    header[e + 1] = size >= 256 ? 0 : size
    header.writeUInt16LE(1, e + 4) // colour planes
    header.writeUInt16LE(32, e + 6) // bits per pixel
    header.writeUInt32LE(images[i].length, e + 8)
    header.writeUInt32LE(offset, e + 12)
    offset += images[i].length
  })
  return Buffer.concat([header, ...images])
}
// Used by the Start menu shortcut that `npm run shortcut` creates.
writeFileSync(join(out, 'icon.ico'), ico([16, 24, 32, 48, 64, 128, 256]))
const variants = [
  ['', 16],
  ['@1.25x', 20],
  ['@1.5x', 24],
  ['@2x', 32]
]
for (const [suffix, px] of variants) {
  // tray-light: dark glyph for a light taskbar; tray-dark: white glyph for a dark one.
  writeFileSync(join(out, `tray-light${suffix}.png`), trayIcon(px, hex('#1d1d1f')).png())
  writeFileSync(join(out, `tray-dark${suffix}.png`), trayIcon(px, [1, 1, 1]).png())
}
console.log('Icons written to resources/')
