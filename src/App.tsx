import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Field, Modal, TextInput, isTyping } from './components/ui'
import { buildMod, MINECRAFT_VERSION } from './codegen/modProject'
import { MOD_ID_RE } from './codegen/names'
import { GuiPanel } from './gui/GuiPanel'
import { downloadText, downloadZip, pickFile } from './lib/files'
import { ModelerPanel } from './modeler/ModelerPanel'
import { NodesPanel } from './nodes/NodesPanel'
import { newProject } from './project/defaults'
import { redo, undo, useProject, useUi, type Panel } from './project/store'
import type { Project } from './project/types'

const CodePanel = lazy(() => import('./code/CodePanel'))

const PANELS: { id: Panel; label: string; icon: string }[] = [
  { id: 'modeler', label: 'Modèle', icon: 'M12 2 3 7v10l9 5 9-5V7zm0 2.3L18.7 8 12 11.7 5.3 8zM5 9.7l6 3.4v6.6l-6-3.4zm8 10V13l6-3.4v6.6z' },
  { id: 'gui', label: 'Interface', icon: 'M3 4h18v16H3zm2 2v3h14V6zm0 5v7h6v-7zm8 0v2h6v-2zm0 4v3h6v-3z' },
  { id: 'nodes', label: 'Nœuds', icon: 'M3 4h7v6H3zm11 10h7v6h-7zM10 6.5h3a2 2 0 0 1 2 2V14h-2V8.5h-3zM3 14h7v6H3z' },
  { id: 'code', label: 'Code', icon: 'm8.6 16.6-4.6-4.6 4.6-4.6L7.2 6 1.2 12l6 6zm6.8 0 4.6-4.6-4.6-4.6L16.8 6l6 6-6 6z' },
]

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d={d} />
    </svg>
  )
}

function isProject(x: unknown): x is Project {
  const p = x as Project
  return !!p && p.format === 'tessera' && !!p.meta && Array.isArray(p.models) && Array.isArray(p.guis) && !!p.logic
}

function ProjectDialog({ onClose }: { onClose: () => void }) {
  const meta = useProject((s) => s.project.meta)
  const update = useProject((s) => s.update)
  const set = (key: keyof typeof meta) => (v: string) => update((p) => void (p.meta[key] = v))
  return (
    <Modal title="Réglages du mod" onClose={onClose}>
      <Field label="Nom affiché">
        <TextInput value={meta.name} onChange={set('name')} />
      </Field>
      <Field label="Mod id (minuscules, chiffres, _)">
        <TextInput value={meta.modId} onChange={(v) => set('modId')(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
      </Field>
      {!MOD_ID_RE.test(meta.modId) && <p className="hint" style={{ color: 'var(--error)' }}>Le mod id doit commencer par une lettre et faire au moins 2 caractères.</p>}
      <div className="row">
        <Field label="Version">
          <TextInput value={meta.version} onChange={set('version')} />
        </Field>
        <Field label="Auteurs">
          <TextInput value={meta.authors} onChange={set('authors')} />
        </Field>
      </div>
      <Field label="Description">
        <TextInput value={meta.description} onChange={set('description')} />
      </Field>
      <div className="actions">
        <button className="primary" onClick={onClose}>
          Fermer
        </button>
      </div>
    </Modal>
  )
}

export default function App() {
  const project = useProject((s) => s.project)
  const replace = useProject((s) => s.replace)
  const { panel, set } = useUi()
  const [showSettings, setShowSettings] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const build = useMemo(() => buildMod(project), [project])
  const errors = build.diagnostics.filter((d) => d.level === 'error').length
  const warnings = build.diagnostics.length - errors

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod || isTyping(e)) return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault()
        redo()
      } else if (e.key === 's') {
        e.preventDefault()
        saveProject()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(t)
  }, [message])

  const resetSelection = () => set({ modelId: null, cubeId: null, guiId: null, elementId: null, codeFile: null })

  const saveProject = () => downloadText(JSON.stringify(project, null, 2), `${project.meta.modId}.tessera.json`, 'application/json')

  const openProject = async () => {
    const file = await pickFile('.json,application/json')
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (!isProject(data)) throw new Error('Ce fichier n’est pas un projet Tessera.')
      replace(data)
      resetSelection()
      setMessage(`Projet « ${data.meta.name} » ouvert.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  const exportMod = async () => {
    if (errors > 0) {
      setMessage(`Corrigez d’abord ${errors} erreur${errors > 1 ? 's' : ''} (onglet Nœuds).`)
      set({ panel: 'nodes' })
      return
    }
    await downloadZip(build.files, `${project.meta.modId}-${project.meta.version}-sources.zip`)
    setMessage('Sources du mod exportées. Voir README.md pour compiler le .jar.')
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <i style={{ background: '#c4573a' }} />
            <i style={{ background: '#b88a2c' }} />
            <i style={{ background: '#3b78c4' }} />
            <i style={{ background: '#5fb760' }} />
          </span>
          Tessera
        </div>
        <button className="ghost project-name" onClick={() => setShowSettings(true)} title="Réglages du mod">
          {project.meta.name} <span className="tag">{project.meta.modId}</span>
        </button>
        <div className="spacer" />
        {message && <span className="hint">{message}</span>}
        <button className="ghost" onClick={undo} title="Annuler (Ctrl/Cmd+Z)">
          ↶
        </button>
        <button className="ghost" onClick={redo} title="Rétablir (Ctrl/Cmd+Maj+Z)">
          ↷
        </button>
        <button
          onClick={() => {
            if (confirm('Créer un nouveau projet ? Le projet actuel sera remplacé (pensez à l’enregistrer).')) {
              replace(newProject())
              resetSelection()
            }
          }}
        >
          Nouveau
        </button>
        <button onClick={openProject}>Ouvrir</button>
        <button onClick={saveProject} title="Ctrl/Cmd+S">
          Enregistrer
        </button>
        <button className="primary" onClick={exportMod}>
          Exporter le mod
        </button>
      </header>

      <nav className="rail">
        {PANELS.map((p) => (
          <button key={p.id} className={panel === p.id ? 'active' : ''} onClick={() => set({ panel: p.id })}>
            <Icon d={p.icon} />
            {p.label}
          </button>
        ))}
      </nav>

      <main className="main">
        {panel === 'modeler' && <ModelerPanel />}
        {panel === 'gui' && <GuiPanel />}
        {panel === 'nodes' && <NodesPanel />}
        {panel === 'code' && (
          <Suspense fallback={<div className="empty">Chargement de l’éditeur…</div>}>
            <CodePanel />
          </Suspense>
        )}
      </main>

      <footer className="statusbar">
        <span>NeoForge {MINECRAFT_VERSION}</span>
        <span className={errors ? 'err' : ''}>{errors} erreur{errors > 1 ? 's' : ''}</span>
        <span className={warnings ? 'warn' : ''}>{warnings} avertissement{warnings > 1 ? 's' : ''}</span>
        <span style={{ marginLeft: 'auto' }}>Sauvegarde automatique dans le navigateur</span>
      </footer>

      {showSettings && <ProjectDialog onClose={() => setShowSettings(false)} />}
    </div>
  )
}
