import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { temporal } from 'zundo'
import { produce } from 'immer'
import { newProject } from './defaults'
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
    { name: 'tessera.project', partialize: (s) => ({ project: s.project }) },
  ),
)

export const undo = () => useProject.temporal.getState().undo()
export const redo = () => useProject.temporal.getState().redo()

export type Panel = 'modeler' | 'gui' | 'nodes' | 'code'

interface UiState {
  panel: Panel
  modelId: string | null
  cubeId: string | null
  guiId: string | null
  elementId: string | null
  codeFile: string | null
  set: (patch: Partial<Omit<UiState, 'set'>>) => void
}

export const useUi = create<UiState>()((set) => ({
  panel: 'nodes',
  modelId: null,
  cubeId: null,
  guiId: null,
  elementId: null,
  codeFile: null,
  set: (patch) => set(patch),
}))
