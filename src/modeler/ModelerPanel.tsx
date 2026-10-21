import { useEffect, useState } from 'react'
import { ColorInput, Field, Section, TextInput, Vec3Input, isTyping } from '../components/ui'
import { newCube, newId, newModel } from '../project/defaults'
import { useProject, useUi } from '../project/store'
import type { Cube, Vec3 } from '../project/types'
import { downloadText, pickFile } from '../lib/files'
import { slug } from '../codegen/names'
import { buildBbmodel, importBbmodel, layoutUv, paintTexture } from './bbmodel'
import { Viewport, type TransformMode } from './Viewport'

export function ModelerPanel() {
  const models = useProject((s) => s.project.models)
  const update = useProject((s) => s.update)
  const { modelId, cubeId, set } = useUi()
  const [mode, setMode] = useState<TransformMode>('translate')
  const [error, setError] = useState<string | null>(null)

  const model = models.find((m) => m.id === modelId) ?? models[0] ?? null
  const cube = model?.cubes.find((c) => c.id === cubeId) ?? null

  const updateModel = (fn: (m: (typeof models)[number]) => void) =>
    update((p) => {
      const m = p.models.find((x) => x.id === model?.id)
      if (m) fn(m)
    })
  const updateCube = (id: string, fn: (c: Cube) => void) =>
    updateModel((m) => {
      const c = m.cubes.find((x) => x.id === id)
      if (c) fn(c)
    })

  const addCube = () => {
    const c = newCube({ name: `cube_${(model?.cubes.length ?? 0) + 1}` })
    updateModel((m) => void m.cubes.push(c))
    set({ cubeId: c.id })
  }
  const duplicateCube = () => {
    if (!cube) return
    const c: Cube = { ...structuredClone(cube), id: newId(), name: cube.name + '_copie' }
    c.from = [c.from[0] + 2, c.from[1], c.from[2] + 2]
    c.origin = [c.origin[0] + 2, c.origin[1], c.origin[2] + 2]
    updateModel((m) => void m.cubes.splice(m.cubes.findIndex((x) => x.id === cube.id) + 1, 0, c))
    set({ cubeId: c.id })
  }
  const deleteCube = () => {
    if (!cube) return
    updateModel((m) => void (m.cubes = m.cubes.filter((x) => x.id !== cube.id)))
    set({ cubeId: null })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || useUi.getState().panel !== 'modeler') return
      if (e.key === 'Delete' || e.key === 'Backspace') deleteCube()
      else if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault()
        duplicateCube()
      } else if (e.key === 'g') setMode('translate')
      else if (e.key === 'r' && !e.metaKey && !e.ctrlKey) setMode('rotate')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const exportBb = () => {
    if (!model) return
    const layout = layoutUv(model.cubes)
    const bb = buildBbmodel(model, layout, paintTexture(model, layout))
    downloadText(JSON.stringify(bb), `${slug(model.name, 'modele')}.bbmodel`, 'application/json')
  }

  const importBb = async () => {
    const file = await pickFile('.bbmodel,application/json')
    if (!file) return
    try {
      const m = importBbmodel(JSON.parse(await file.text()), file.name.replace(/\.bbmodel$/, ''), newId)
      update((p) => void p.models.push(m))
      set({ modelId: m.id, cubeId: null })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="panel">
      <aside className="side">
        <Section
          title="Modèles"
          actions={
            <>
              <button title="Importer un .bbmodel" onClick={importBb}>
                Importer
              </button>
              <button
                onClick={() => {
                  const m = newModel(`modele_${models.length + 1}`)
                  update((p) => void p.models.push(m))
                  set({ modelId: m.id, cubeId: null })
                }}
              >
                +
              </button>
            </>
          }
        >
          <div className="list">
            {models.map((m) => (
              <div
                key={m.id}
                className={'list-item' + (m.id === model?.id ? ' selected' : '')}
                onClick={() => set({ modelId: m.id, cubeId: null })}
              >
                <span className="grow">{m.name}</span>
                <span className="tag">{m.cubes.length}</span>
              </div>
            ))}
          </div>
          {error && <p className="hint" style={{ color: 'var(--error)' }}>{error}</p>}
        </Section>
        {model && (
          <Section
            title="Cubes"
            actions={
              <button onClick={addCube} title="Ajouter un cube">
                +
              </button>
            }
          >
            <div className="list">
              {model.cubes.map((c) => (
                <div
                  key={c.id}
                  className={'list-item' + (c.id === cube?.id ? ' selected' : '')}
                  onClick={() => set({ cubeId: c.id })}
                >
                  <span className="swatch" style={{ background: c.color }} />
                  <span className="grow">{c.name}</span>
                </div>
              ))}
            </div>
          </Section>
        )}
        <Section title="Animation">
          <p className="hint">
            Tessera ne fait pas d’animation. Exportez le modèle en .bbmodel : chaque cube y devient un os prêt à
            animer dans Blockbench.
          </p>
        </Section>
      </aside>

      <div className="stage">
        {model ? (
          <>
            <div className="toolbar">
              <div className="seg">
                <button className={mode === 'translate' ? 'active' : ''} onClick={() => setMode('translate')} title="Déplacer (G)">
                  Déplacer
                </button>
                <button className={mode === 'rotate' ? 'active' : ''} onClick={() => setMode('rotate')} title="Tourner (R)">
                  Tourner
                </button>
              </div>
              <div className="spacer" />
              <button className="primary" onClick={exportBb}>
                Exporter .bbmodel
              </button>
            </div>
            <Viewport
              model={model}
              selectedId={cube?.id ?? null}
              mode={mode}
              onSelect={(id) => set({ cubeId: id })}
              onMove={(id, d) =>
                updateCube(id, (c) => {
                  c.from = [c.from[0] + d[0], c.from[1] + d[1], c.from[2] + d[2]]
                  c.origin = [c.origin[0] + d[0], c.origin[1] + d[1], c.origin[2] + d[2]]
                })
              }
              onRotate={(id, r) => updateCube(id, (c) => void (c.rotation = r))}
            />
          </>
        ) : (
          <div className="empty">Créez un modèle pour commencer.</div>
        )}
      </div>

      <aside className="side right">
        {model && (
          <Section
            title="Modèle"
            actions={
              <button
                className="danger"
                disabled={models.length <= 1}
                onClick={() => {
                  update((p) => void (p.models = p.models.filter((m) => m.id !== model.id)))
                  set({ modelId: null, cubeId: null })
                }}
              >
                Supprimer
              </button>
            }
          >
            <Field label="Nom">
              <TextInput value={model.name} onChange={(v) => updateModel((m) => void (m.name = v))} />
            </Field>
          </Section>
        )}
        {cube ? (
          <Section
            title="Cube"
            actions={
              <>
                <button onClick={duplicateCube} title="Dupliquer (Ctrl/Cmd+D)">
                  Dupliquer
                </button>
                <button className="danger" onClick={deleteCube} title="Supprimer (Suppr)">
                  Supprimer
                </button>
              </>
            }
          >
            <Field label="Nom">
              <TextInput value={cube.name} onChange={(v) => updateCube(cube.id, (c) => void (c.name = v))} />
            </Field>
            <Field label="Couleur">
              <ColorInput value={cube.color} onChange={(v) => updateCube(cube.id, (c) => void (c.color = v))} />
            </Field>
            <Field label="Position (coin)">
              <Vec3Input value={cube.from} onChange={(v) => updateCube(cube.id, (c) => void (c.from = v))} />
            </Field>
            <Field label="Taille">
              <Vec3Input
                value={cube.size}
                min={0}
                onChange={(v) => updateCube(cube.id, (c) => void (c.size = v))}
              />
            </Field>
            <Field label="Pivot">
              <Vec3Input value={cube.origin} onChange={(v) => updateCube(cube.id, (c) => void (c.origin = v))} />
            </Field>
            <Field label="Rotation (°)">
              <Vec3Input
                value={cube.rotation}
                step={7.5}
                onChange={(v: Vec3) => updateCube(cube.id, (c) => void (c.rotation = v))}
              />
            </Field>
            <p className="hint">Unités en pixels : 16 = un bloc.</p>
          </Section>
        ) : (
          <Section title="Cube">
            <p className="hint">Cliquez sur un cube dans la vue 3D ou dans la liste pour le modifier.</p>
          </Section>
        )}
      </aside>
    </div>
  )
}
