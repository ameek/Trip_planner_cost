import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PINE = [28, 43, 33]
const PAPER = [247, 243, 232]
const DUSK = [43, 58, 84]
const CLAY = [181, 101, 45]

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
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
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, draw) {
  const raw = Buffer.alloc(size * (1 + size * 3))
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 3)
    raw[rowStart] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b] = draw(x, y)
      const off = rowStart + 1 + x * 3
      raw[off] = r
      raw[off + 1] = g
      raw[off + 2] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function dotAt(size, cx, cy, r, color) {
  const originX = size / 2 + cx * size
  const originY = size / 2 + cy * size
  return (x, y) => {
    const dx = x - originX
    const dy = y - originY
    return dx * dx + dy * dy <= (r * size) ** 2 ? color : null
  }
}

function buildIcon(size, maskable = false) {
  const safe = maskable ? 0.82 : 1
  const dot1 = dotAt(size, 0.31 - 0.5, 0.31 - 0.5, 0.1 * safe, PAPER)
  const dot2 = dotAt(size, 0.5 - 0.5, 0.56 - 0.5, 0.1 * safe, DUSK)
  const dot3 = dotAt(size, 0.69 - 0.5, 0.81 - 0.5, 0.1 * safe, CLAY)
  return encodePng(size, (x, y) => {
    for (const d of [dot3, dot2, dot1]) {
      const c = d(x, y)
      if (c) return c
    }
    return PINE
  })
}

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public')
mkdirSync(outDir, { recursive: true })

const targets = [
  ['pwa-192.png', 192, false],
  ['pwa-512.png', 512, false],
  ['pwa-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, false],
]

for (const [name, size, maskable] of targets) {
  const png = buildIcon(size, maskable)
  writeFileSync(join(outDir, name), png)
  console.log(`wrote ${name} (${size}x${size}) ${png.length} bytes`)
}