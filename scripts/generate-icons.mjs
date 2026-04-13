/**
 * Generates icon-192.png and icon-512.png for the PWA manifest.
 * Uses only Node.js built-ins (no external dependencies).
 * Draws a blue rounded rectangle with "FF" text using raw PNG + zlib.
 */
import { createWriteStream } from 'fs'
import { deflateSync } from 'zlib'
import { mkdir } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dir, '..', 'public', 'icons')

await mkdir(outDir, { recursive: true })

// CRC32 table
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function uint32be(n) {
  const b = Buffer.allocUnsafe(4)
  b.writeUInt32BE(n, 0)
  return b
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.concat([typeBytes, data])
  return Buffer.concat([uint32be(data.length), typeBytes, data, uint32be(crc32(crcBuf))])
}

function buildPNG(size) {
  // RGBA pixel data
  const pixels = Buffer.alloc(size * size * 4)

  // Background color: #3b82f6 (accent blue)
  const bgR = 0x3b, bgG = 0x82, bgB = 0xf6

  // Rounded corner radius ~14% of size
  const r = Math.round(size * 0.14)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      // Check if inside rounded rect
      const inRect = x >= r && x < size - r && y >= 0 && y < size
        || x >= 0 && x < size && y >= r && y < size - r

      // Corner circles
      const corners = [
        [r, r], [size - r - 1, r],
        [r, size - r - 1], [size - r - 1, size - r - 1],
      ]
      const inCorner = corners.some(([cx, cy]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r)

      if (inRect || inCorner) {
        pixels[idx]     = bgR
        pixels[idx + 1] = bgG
        pixels[idx + 2] = bgB
        pixels[idx + 3] = 255
      } else {
        pixels[idx + 3] = 0 // transparent
      }
    }
  }

  // Draw "FF" text as white pixels — simple 5×7 bitmap font, scaled
  const letterF = [
    [1,1,1,1,1],
    [1,0,0,0,0],
    [1,1,1,1,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
  ]

  const scale = Math.round(size * 0.11)
  const gap   = Math.round(size * 0.04)
  const totalW = (5 * scale) * 2 + gap
  const totalH = 7 * scale
  const startX = Math.round((size - totalW) / 2)
  const startY = Math.round((size - totalH) / 2)

  const drawLetter = (offsetX) => {
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (!letterF[row][col]) continue
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = offsetX + col * scale + sx
            const py = startY + row * scale + sy
            if (px < 0 || px >= size || py < 0 || py >= size) continue
            const idx = (py * size + px) * 4
            pixels[idx]     = 255
            pixels[idx + 1] = 255
            pixels[idx + 2] = 255
            pixels[idx + 3] = 255
          }
        }
      }
    }
  }

  drawLetter(startX)
  drawLetter(startX + 5 * scale + gap)

  // Build raw image data (filter byte 0 = None per scanline)
  const raw = Buffer.allocUnsafe(size * (1 + size * 4))
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0 // filter type None
    pixels.copy(raw, y * (1 + size * 4) + 1, y * size * 4, (y + 1) * size * 4)
  }

  const compressed = deflateSync(raw, { level: 6 })

  const IHDR = Buffer.concat([
    uint32be(size), uint32be(size),
    Buffer.from([8, 6, 0, 0, 0]), // 8-bit depth, RGBA, no compression, no filter, no interlace
  ])

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk('IHDR', IHDR),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [192, 512]) {
  const png = buildPNG(size)
  const path = join(outDir, `icon-${size}.png`)
  const ws = createWriteStream(path)
  ws.write(png)
  ws.end()
  console.log(`✓ ${path} (${png.length} bytes)`)
}
