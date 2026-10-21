import { useState } from 'react'
import { TEMPLATES } from '../project/defaults'
import { useSession } from '../project/session'
import { useProject } from '../project/store'
import type { Project } from '../project/types'
import { platform } from '../platform'

interface Props {
  onOpen: (project: Project, location: string | null) => void
  onClose: () => void
}

export function Welcome({ onOpen, onClose }: Props) {
  const current = useProject((s) => s.project.meta.name)
  const { recent, forget } = useSession()
  const [error, setError] = useState<string | null>(null)

  const open = async (fn: () => Promise<{ project: Project; location: string | null } | null>) => {
    try {
      const r = await fn()
      if (r) onOpen(r.project, r.location)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal welcome" role="dialog" aria-label="Accueil">
        <div className="welcome-head">
          <span className="brand-mark big" aria-hidden>
            <i style={{ background: '#c4573a' }} />
            <i style={{ background: '#b88a2c' }} />
            <i style={{ background: '#3b78c4' }} />
            <i style={{ background: '#5fb760' }} />
          </span>
          <div>
            <h2>Tessera</h2>
            <p className="hint">Créez des mods NeoForge 1.21.1 : modèles, interfaces, contenu et logique en nœuds.</p>
          </div>
        </div>

        <div className="welcome-grid">
          <div>
            <div className="section-title">Nouveau projet</div>
            <div className="list">
              {TEMPLATES.map((t) => (
                <button key={t.id} className="template" onClick={() => onOpen(t.create(), null)}>
                  <b>{t.name}</b>
                  <span className="hint">{t.description}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="section-title">Ouvrir</div>
            <div className="list">
              <button className="template" onClick={onClose}>
                <b>Continuer « {current} »</b>
                <span className="hint">Le projet en cours (sauvegarde automatique).</span>
              </button>
              <button className="template" onClick={() => open(() => platform.openProject())}>
                <b>{platform.desktop ? 'Ouvrir un dossier de projet…' : 'Ouvrir un fichier .tessera.json…'}</b>
              </button>
              {platform.desktop &&
                recent.map((r) => (
                  <div key={r.location} className="list-item recent" onClick={() => open(async () => ({ project: await platform.openProjectAt(r.location), location: r.location }))}>
                    <span className="grow">
                      {r.name}
                      <br />
                      <span className="hint">{r.location}</span>
                    </span>
                    <button
                      className="ghost"
                      title="Retirer de la liste"
                      onClick={(e) => {
                        e.stopPropagation()
                        forget(r.location)
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
        {error && <p className="hint" style={{ color: 'var(--error)' }}>{error}</p>}
      </div>
    </div>
  )
}
