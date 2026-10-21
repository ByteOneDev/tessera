import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { buildMod } from '../codegen/modProject'
import { platform } from '../platform'
import { gradleWrapperFiles } from '../platform/wrapper'
import { useProject, useUi } from '../project/store'

interface BuildState {
  open: boolean
  running: boolean
  log: string[]
  result: { ok: boolean; jarPath?: string | null; error?: string | null } | null
  set: (patch: Partial<Omit<BuildState, 'set'>>) => void
}

export const useBuild = create<BuildState>()((set) => ({
  open: false,
  running: false,
  log: [],
  result: null,
  set: (patch) => set(patch),
}))

const MAX_LINES = 4000

/** Lance un Build (FR-17). Refuse s'il reste des erreurs. */
export async function runBuild() {
  const { set, running } = useBuild.getState()
  if (running) return
  const project = useProject.getState().project
  const build = buildMod(project)
  const errors = build.diagnostics.filter((d) => d.level === 'error')
  if (errors.length) {
    set({ open: true, log: errors.map((e) => `Erreur : ${e.message}`), result: { ok: false, error: `${errors.length} erreur(s) à corriger avant le Build.` } })
    if (errors.some((e) => e.nodeId)) useUi.getState().set({ panel: 'nodes' })
    return
  }
  set({ open: true, running: true, log: [`Build de ${project.meta.modId} ${project.meta.version}…`], result: null })
  let pending: string[] = []
  const flush = setInterval(() => {
    if (!pending.length) return
    const lines = pending
    pending = []
    useBuild.setState((s) => ({ log: [...s.log, ...lines].slice(-MAX_LINES) }))
  }, 100)
  try {
    const files = [...build.files, ...(await gradleWrapperFiles())]
    const result = await platform.build(project.meta.modId, files, (line) => pending.push(line))
    set({ result })
  } catch (e) {
    set({ result: { ok: false, error: String(e) } })
  } finally {
    clearInterval(flush)
    useBuild.setState((s) => ({ running: false, log: [...s.log, ...pending].slice(-MAX_LINES) }))
  }
}

export function BuildPanel() {
  const { open, running, log, result, set } = useBuild()
  const logRef = useRef<HTMLPreElement>(null)
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [log])
  if (!open) return null
  return (
    <div className="build-panel">
      <div className="build-head">
        <b>Build</b>
        {running && <span className="hint">Compilation en cours…</span>}
        {result?.ok && <span className="ok">Mod prêt : {result.jarPath}</span>}
        {result && !result.ok && <span className="err">{result.error ?? 'Échec de la compilation : voir le journal.'}</span>}
        <div className="spacer" />
        {result?.ok && result.jarPath && <button onClick={() => platform.reveal(result.jarPath!)}>Afficher le .jar</button>}
        <button onClick={() => navigator.clipboard?.writeText(log.join('\n'))}>Copier le journal</button>
        <button className="ghost" onClick={() => set({ open: false })} title="Fermer">
          ✕
        </button>
      </div>
      <pre ref={logRef} className="build-log">
        {log.join('\n')}
      </pre>
    </div>
  )
}
