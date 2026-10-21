// Session : où est enregistré le projet ouvert, projets récents, modifications non enregistrées.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useProject } from './store'

export interface RecentProject {
  location: string
  name: string
  openedAt: number
}

interface SessionState {
  location: string | null
  dirty: boolean
  recent: RecentProject[]
  welcome: boolean
  setLocation: (location: string | null, name?: string) => void
  markSaved: () => void
  forget: (location: string) => void
  showWelcome: (v: boolean) => void
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      location: null,
      dirty: false,
      recent: [],
      welcome: true,
      setLocation: (location, name) =>
        set((s) => ({
          location,
          dirty: false,
          recent:
            location && name
              ? [{ location, name, openedAt: Date.now() }, ...s.recent.filter((r) => r.location !== location)].slice(0, 8)
              : s.recent,
        })),
      markSaved: () => set({ dirty: false }),
      forget: (location) => set((s) => ({ recent: s.recent.filter((r) => r.location !== location) })),
      showWelcome: (welcome) => set({ welcome }),
    }),
    {
      name: 'tessera.session',
      partialize: (s) => ({ location: s.location, recent: s.recent }),
    },
  ),
)

// Toute modification du projet le marque comme non enregistré.
useProject.subscribe((s, prev) => {
  if (s.project !== prev.project && !useSession.getState().dirty) useSession.setState({ dirty: true })
})
