import { describe, expect, it } from 'vitest'
import { newProject } from '../project/defaults'
import { fromDisk, toDisk } from './diskFormat'

describe('format disque (AD-5)', () => {
  it('extrait les images dans assets/ et les restaure', () => {
    const p = newProject()
    const { json, assets } = toDisk(p)
    expect(json).not.toContain('data:image/png')
    expect(assets.length).toBeGreaterThan(0)
    expect(assets.every((a) => /^assets\/[0-9a-f]{8}[0-9a-z]+\.png$/.test(a.path))).toBe(true)
    expect(fromDisk(json, assets)).toEqual(p)
  })
  it('déduplique les images identiques', () => {
    const p = newProject()
    const tex = p.content[0].texture
    p.content.push({ ...p.content[0], id: 'copie', texture: tex })
    expect(toDisk(p).assets).toHaveLength(1)
  })
  it('signale un JSON invalide', () => {
    expect(() => fromDisk('{', [])).toThrow(/JSON valide/)
  })
})
