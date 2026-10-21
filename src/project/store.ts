import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { temporal } from 'zundo'
import { produce } from 'immer'
import { newProject } from './defaults'
import { migrate } from './migrate'
import type { Project } from './types'

interface ProjectState {
  project: Project
  /** Modifie le projet via un brouillon immer. */
  update: (recipe: (draft: Project) => void) => void
  replace: (project: Project) => void
}

/** Regroupe les modifications rapprochées (glisser, saisie) en une seule étape d'annulation. */
const groupBursts = (handleSet: (...args: never[]) => void) => {
  let last = 0
  return (...args: never[]) => {
    const now = Date.now()
    if (now - last > 400) handleSet(...args)
    last = now
  }
}

export const useProject = create<ProjectState>()(
  persist(
    temporal(
      (set) => ({
        project: newProject(),
        update: (recipe) => set((s) => ({ project: produce(s.project, recipe) })),
        replace: (project) => set({ project }),
      }),
      {
        limit: 100,
        partialize: (s) => ({ project: s.project }),
        handleSet: groupBursts as never,
      },
    ),
    {
      name: 'tessera.project',
      version: 2,
      partialize: (s) => ({ project: s.project }),
      // Sauvegarde de secours d'une version précédente : même chemin de migration qu'à l'ouverture (AD-5).
      migrate: (persisted) => {
        try {
          return { project: migrate((persisted as { project?: unknown })?.project) }
        } catch {
          return { project: newProject() }
        }
      },
    },
  ),
)

export const undo = () => useProject.temporal.getState().undo()
export const redo = () => useProject.temporal.getState().redo()

export type Panel = 'modeler' | 'gui' | 'nodes' | 'content' | 'code'

interface UiState {
  panel: Panel
  modelId: string | null
  cubeId: string | null
  guiId: string | null
  elementId: string | null
  codeFile: string | null
  contentId: string | null
  set: (patch: Partial<Omit<UiState, 'set'>>) => void
}

export const useUi = create<UiState>()((set) => ({
  panel: 'nodes',
  modelId: null,
  cubeId: null,
  guiId: null,
  elementId: null,
  codeFile: null,
  contentId: null,
  set: (patch) => set(patch),
}))
