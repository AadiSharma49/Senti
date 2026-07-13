/**
 * Generates the Senti app icon (build/icon.png, 256x256) with no image deps:
 * a dark rounded tile with the cyan Senti orb — a glowing ring with a gap,
 * matching the lock screen visualizer.
 *
 * Run with: npm run make:icon
 */
import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '..', 'build', 'icon.png')

const S = 256
const BG = [10, 13, 18] // near-black, matches the app
const ACCENT = [0, 212, 255] // Senti cyan

const px = Buffer.alloc(S * S * 4)

const clamp01 = (v) => Math.min(1, Math.max(0, v))
/** Soft coverage for antialiasing: 1 inside, 0 outside, ramp across ~1px. */
const cover = (d, edge) => clamp01(0.5 - (d - edge))

function blend(i, rgb, a) {
  if (a <= 0) return
  for (let c = 0; c < 3; c++) {
    px[i + c] = Math.round(px[i + c] * (1 - a) + rgb[c] * a)
  }
  px[i + 3] = Math.max(px[i + 3], Math.round(255 * a))
}

const cx = S / 2
const cy = S / 2
const R = 88 // ring radius
const THICK = 13 // ring thickness

for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4

    // Rounded-square background tile.
    const rx = Math.abs(x - cx) - (S / 2 - 34)
    const ry = Math.abs(y - cy) - (S / 2 - 34)
    const dBox =
      Math.hypot(Math.max(rx, 0), Math.max(ry, 0)) + Math.min(Math.max(rx, ry), 0) - 34
    const inBox = cover(dBox, 0)
    px[i] = BG[0]
    px[i + 1] = BG[1]
    px[i + 2] = BG[2]
    px[i + 3] = Math.round(255 * inBox)

    const dx = x - cx
    const dy = y - cy
    const dist = Math.hypot(dx, dy)

    // Outer glow around the orb.
    const glow = clamp01(1 - Math.abs(dist - R) / 46) ** 2.4
    blend(i, ACCENT, glow * 0.3 * inBox)

    // The ring itself, with a gap at the top-right (the orb "opening").
    const ang = Math.atan2(dy, dx) // -PI..PI
    const inGap = ang > -1.15 && ang < -0.28
    if (!inGap) {
      const ringA = cover(Math.abs(dist - R), THICK / 2)
      blend(i, ACCENT, ringA * inBox)
    }

    // Center core dot.
    const core = cover(dist, 15)
    blend(i, ACCENT, core * 0.92 * inBox)
  }
}

// --- minimal PNG encoder ---
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(S, 0)
ihdr.writeUInt32BE(S, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // RGBA
// 10,11,12 = 0 (deflate, adaptive filter, no interlace)

// Each scanline gets a leading filter byte (0 = none).
const raw = Buffer.alloc(S * (S * 4 + 1))
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0
  px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4)
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

mkdirSync(path.dirname(OUT), { recursive: true })
writeFileSync(OUT, png)
console.log(`[make-icon] wrote ${OUT} (${S}x${S}, ${(png.length / 1024).toFixed(1)} KB)`)
