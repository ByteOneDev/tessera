// Encodeur PNG minimal et pur (RGBA 8 bits, zlib sans compression) : utilisable dans le codegen et les tests.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function adler32(bytes: Uint8Array): number {
  let a = 1
  let b = 0
  for (const x of bytes) {
    a = (a + x) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]

function chunk(type: string, data: Uint8Array): number[] {
  const head = new Uint8Array([...type].map((c) => c.charCodeAt(0)))
  const body = new Uint8Array(head.length + data.length)
  body.set(head)
  body.set(data, head.length)
  return [...u32(data.length), ...body, ...u32(crc32(body))]
}

function zlibStored(raw: Uint8Array): Uint8Array {
  const out: number[] = [0x78, 0x01]
  for (let i = 0; i < raw.length || i === 0; i += 65535) {
    const block = raw.subarray(i, i + 65535)
    const last = i + 65535 >= raw.length ? 1 : 0
    out.push(last, block.length & 255, block.length >>> 8, ~block.length & 255, (~block.length >>> 8) & 255, ...block)
    if (raw.length === 0) break
  }
  out.push(...u32(adler32(raw)))
  return new Uint8Array(out)
}

/** Encode des pixels RGBA (largeur × hauteur × 4 octets) en PNG. */
export function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const raw = new Uint8Array(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1)
  }
  const ihdr = new Uint8Array([...u32(width), ...u32(height), 8, 6, 0, 0, 0])
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', ihdr),
    ...chunk('IDAT', zlibStored(raw)),
    ...chunk('IEND', new Uint8Array()),
  ])
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

export const pngDataUrl = (width: number, height: number, rgba: Uint8Array) =>
  'data:image/png;base64,' + bytesToBase64(encodePng(width, height, rgba))

/** Image RGBA modifiable pixel par pixel. */
export class Bitmap {
  readonly data: Uint8Array
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8Array(width * height * 4)
  }
  fillRect(x: number, y: number, w: number, h: number, hex: string, alpha = 255) {
    const n = parseInt(hex.replace('#', ''), 16)
    const rgba = [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha]
    for (let j = Math.max(0, y); j < Math.min(this.height, y + h); j++)
      for (let i = Math.max(0, x); i < Math.min(this.width, x + w); i++) this.data.set(rgba, (j * this.width + i) * 4)
  }
  toDataUrl() {
    return pngDataUrl(this.width, this.height, this.data)
  }
}
