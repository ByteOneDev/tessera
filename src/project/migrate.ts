// Ouverture d'un projet : validation et mise à niveau du format (AD-5).
import type { Project } from './types'

export const CURRENT_FORMAT_VERSION = 2

type Raw = Record<string, unknown> & { formatVersion?: number }

const MIGRATIONS: Record<number, (p: Raw) => Raw> = {
  // v1 → v2 : ajout du Contenu personnalisé.
  1: (p) => ({ ...p, content: [], formatVersion: 2 }),
}

export function migrate(data: unknown): Project {
  const p = data as Raw
  if (!p || typeof p !== 'object' || p.format !== 'tessera') throw new Error('Ce fichier n’est pas un projet Tessera.')
  let current: Raw = p
  let version = typeof current.formatVersion === 'number' ? current.formatVersion : 1
  if (version > CURRENT_FORMAT_VERSION) {
    throw new Error(`Ce projet vient d’une version plus récente de Tessera (format ${version}). Mettez Tessera à jour.`)
  }
  while (version < CURRENT_FORMAT_VERSION) {
    current = MIGRATIONS[version](current)
    version = current.formatVersion as number
  }
  const project = current as unknown as Project
  if (!project.meta || !Array.isArray(project.models) || !Array.isArray(project.guis) || !project.logic || !Array.isArray(project.content)) {
    throw new Error('Projet Tessera incomplet ou endommagé.')
  }
  return project
}
