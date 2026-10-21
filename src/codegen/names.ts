import type { Gui, ModMeta } from '../project/types'

export function javaString(s: string): string {
  return (
    '"' +
    s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '').replace(/\n/g, '\\n').replace(/\t/g, '\\t') +
    '"'
  )
}

function words(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
}

export function pascal(s: string, fallback = 'Sans'): string {
  const out = words(s)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('')
  if (!out) return fallback
  return /^[0-9]/.test(out) ? 'X' + out : out
}

/** Identifiant de fichier ou de ressource : minuscules, chiffres, `_`. */
export function slug(s: string, fallback = 'sans_nom'): string {
  const out = words(s).join('_').toLowerCase()
  return out || fallback
}

export const MOD_ID_RE = /^[a-z][a-z0-9_]{1,63}$/

export function packageName(meta: ModMeta): string {
  return `com.${meta.modId}`
}

export function mainClassName(meta: ModMeta): string {
  const base = pascal(meta.name, pascal(meta.modId, 'Tessera'))
  return base.endsWith('Mod') ? base : base + 'Mod'
}

/** Normalise un identifiant Minecraft (`diamond` → `minecraft:diamond`). */
export function resourceId(raw: string): { id: string; valid: boolean } {
  const trimmed = raw.trim().toLowerCase()
  const id = trimmed.includes(':') ? trimmed : `minecraft:${trimmed}`
  return { id, valid: /^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(id) }
}

/** Noms de classes d'écran uniques, indexés par id d'interface. */
export function screenClassNames(guis: Gui[]): Map<string, string> {
  const used = new Set<string>()
  const names = new Map<string, string>()
  for (const gui of guis) {
    if (gui.target !== 'mod') continue
    const base = pascal(gui.name, 'Ecran') + 'Screen'
    let name = base
    for (let i = 2; used.has(name); i++) name = base.replace(/Screen$/, `${i}Screen`)
    used.add(name)
    names.set(gui.id, name)
  }
  return names
}

export function indent(lines: string[], depth = 1): string[] {
  const pad = '    '.repeat(depth)
  return lines.map((l) => (l ? pad + l : l))
}
