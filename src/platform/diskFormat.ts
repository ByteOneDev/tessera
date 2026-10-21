// Projet ↔ dossier sur disque (AD-5) : les images en data URL deviennent des fichiers assets/<empreinte>.png.
import { migrate } from '../project/migrate'
import type { Project } from '../project/types'

const DATA_PNG = 'data:image/png;base64,'
const ASSET = 'asset:'

export interface DiskAsset {
  path: string
  base64: string
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function mapStrings(value: unknown, fn: (s: string) => string): unknown {
  if (typeof value === 'string') return fn(value)
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, fn)]))
  }
  return value
}

export function toDisk(project: Project): { json: string; assets: DiskAsset[] } {
  const assets = new Map<string, string>()
  const replaced = mapStrings(project, (s) => {
    if (!s.startsWith(DATA_PNG)) return s
    const b64 = s.slice(DATA_PNG.length)
    const path = `assets/${fnv1a(b64)}${b64.length.toString(36)}.png`
    assets.set(path, b64)
    return ASSET + path
  })
  return { json: JSON.stringify(replaced, null, 2) + '\n', assets: [...assets].map(([path, base64]) => ({ path, base64 })) }
}

export function fromDisk(json: string, assets: DiskAsset[]): Project {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('tessera.json n’est pas un JSON valide.')
  }
  const byPath = new Map(assets.map((a) => [a.path, a.base64]))
  const restored = mapStrings(data, (s) => {
    if (!s.startsWith(ASSET)) return s
    const b64 = byPath.get(s.slice(ASSET.length))
    return b64 === undefined ? s : DATA_PNG + b64
  })
  return migrate(restored)
}
