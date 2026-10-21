import { useMemo } from 'react'
import { ColorInput, Field, NumberInput, Section, TextInput } from '../components/ui'
import { contentRegistryNames } from '../codegen/content'
import { layoutUv, paintTexture } from '../modeler/bbmodel'
import { newContent } from '../project/defaults'
import { useProject, useUi } from '../project/store'
import type { Content, ContentKind } from '../project/types'
import { TextureEditor } from './TextureEditor'

const KIND_LABEL: Record<ContentKind, string> = { item: 'Objet', block: 'Bloc', entity: 'Créature' }
const KIND_PLURAL: Record<ContentKind, string> = { item: 'Objets', block: 'Blocs', entity: 'Créatures' }

export function ContentPanel() {
  const content = useProject((s) => s.project.content)
  const models = useProject((s) => s.project.models)
  const modId = useProject((s) => s.project.meta.modId)
  const update = useProject((s) => s.update)
  const { contentId, set } = useUi()
  const selected = content.find((c) => c.id === contentId) ?? content[0] ?? null
  const names = useMemo(() => contentRegistryNames(content), [content])

  const updateSel = (fn: (c: Content) => void) =>
    update((p) => {
      const c = p.content.find((x) => x.id === selected?.id)
      if (c) fn(c)
    })

  const add = (kind: ContentKind) => {
    const count = content.filter((c) => c.kind === kind).length + 1
    const c = newContent(kind, `${KIND_LABEL[kind]} ${count}`, models[0]?.id ?? '')
    update((p) => void p.content.push(c))
    set({ contentId: c.id })
  }

  const entityModel = selected?.kind === 'entity' ? models.find((m) => m.id === selected.modelId) : undefined
  const generatedTexture = useMemo(
    () => (entityModel && entityModel.cubes.length ? paintTexture(entityModel, layoutUv(entityModel.cubes)) : null),
    [entityModel],
  )

  return (
    <div className="panel">
      <aside className="side">
        <Section title="Ajouter">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {(['item', 'block', 'entity'] as ContentKind[]).map((k) => (
              <button key={k} style={{ flex: '1 1 auto', padding: '5px 6px' }} onClick={() => add(k)}>
                + {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </Section>
        {(['item', 'block', 'entity'] as ContentKind[]).map((kind) => {
          const items = content.filter((c) => c.kind === kind)
          if (!items.length) return null
          return (
            <Section key={kind} title={KIND_PLURAL[kind]}>
              <div className="list">
                {items.map((c) => (
                  <div key={c.id} className={'list-item' + (c.id === selected?.id ? ' selected' : '')} onClick={() => set({ contentId: c.id })}>
                    {c.kind !== 'entity' && (
                      <span className="swatch pixel" style={{ backgroundImage: c.texture ? `url(${c.texture})` : undefined }} />
                    )}
                    <span className="grow">{c.name}</span>
                  </div>
                ))}
              </div>
            </Section>
          )
        })}
        {!content.length && (
          <div className="section">
            <p className="hint">Ajoutez des objets, des blocs ou des créatures. Ils apparaissent dans l’onglet créatif de votre mod et dans les nœuds.</p>
          </div>
        )}
      </aside>

      <div className="stage" style={{ overflow: 'auto' }}>
        {!selected && <div className="empty">Aucun contenu personnalisé pour l’instant.</div>}
        {selected && selected.kind !== 'entity' && (
          <div className="content-stage">
            <h3>Texture de « {selected.name} »</h3>
            <TextureEditor value={selected.texture} onChange={(url) => updateSel((c) => void (c.texture = url))} />
          </div>
        )}
        {selected?.kind === 'entity' && (
          <div className="content-stage">
            <h3>Apparence de « {selected.name} »</h3>
            {entityModel ? (
              <>
                <p className="hint">
                  La créature utilise le modèle <b>{entityModel.name}</b> ({entityModel.cubes.length} cubes). Sa texture est générée
                  à partir des couleurs des cubes.
                </p>
                {generatedTexture && <img className="pixel texture-preview" src={generatedTexture} alt="Texture générée" />}
                <div className="row" style={{ marginTop: 12 }}>
                  <button onClick={() => useUi.getState().set({ panel: 'modeler', modelId: entityModel.id, cubeId: null })}>Modifier le modèle</button>
                </div>
              </>
            ) : (
              <p className="hint" style={{ color: 'var(--error)' }}>
                Choisissez un modèle (panneau de droite). Créez-en un dans l’onglet Modèle si besoin.
              </p>
            )}
          </div>
        )}
      </div>

      <aside className="side right">
        {selected && (
          <Section
            title={KIND_LABEL[selected.kind]}
            actions={
              <button
                className="danger"
                onClick={() => {
                  update((p) => void (p.content = p.content.filter((c) => c.id !== selected.id)))
                  set({ contentId: null })
                }}
              >
                Supprimer
              </button>
            }
          >
            <Field label="Nom affiché en jeu">
              <TextInput value={selected.name} onChange={(v) => updateSel((c) => void (c.name = v))} />
            </Field>
            <p className="hint" style={{ marginTop: -4, marginBottom: 10 }}>
              Identifiant : <code>{modId}:{names.get(selected.id)}</code>
            </p>
            {selected.kind === 'item' && (
              <Field label="Taille de pile maximale (1-99)">
                <NumberInput value={selected.maxStack} min={1} onChange={(v) => updateSel((c) => c.kind === 'item' && (c.maxStack = Math.min(99, Math.round(v))))} />
              </Field>
            )}
            {selected.kind === 'block' && (
              <Field label="Dureté (terre 0.5, pierre 1.5, obsidienne 50)">
                <NumberInput value={selected.hardness} step={0.5} min={0} onChange={(v) => updateSel((c) => c.kind === 'block' && (c.hardness = v))} />
              </Field>
            )}
            {selected.kind === 'entity' && (
              <>
                <Field label="Modèle">
                  <select value={selected.modelId} onChange={(e) => updateSel((c) => c.kind === 'entity' && (c.modelId = e.target.value))}>
                    <option value="">— choisir —</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="row">
                  <Field label="Points de vie">
                    <NumberInput value={selected.health} min={1} onChange={(v) => updateSel((c) => c.kind === 'entity' && (c.health = v))} />
                  </Field>
                  <Field label="Vitesse">
                    <NumberInput value={selected.speed} step={0.05} min={0} onChange={(v) => updateSel((c) => c.kind === 'entity' && (c.speed = v))} />
                  </Field>
                </div>
                <Field label="Œuf : couleur principale">
                  <ColorInput value={selected.eggPrimary} onChange={(v) => updateSel((c) => c.kind === 'entity' && (c.eggPrimary = v))} />
                </Field>
                <Field label="Œuf : taches">
                  <ColorInput value={selected.eggSecondary} onChange={(v) => updateSel((c) => c.kind === 'entity' && (c.eggSecondary = v))} />
                </Field>
                <p className="hint">Comportement : passif (erre, fuit quand on la frappe, regarde les joueurs). Vitesse d’un cochon : 0.25.</p>
              </>
            )}
          </Section>
        )}
        <Section title="Dans les nœuds">
          <p className="hint">
            Les nœuds « Donner un objet », « Clic droit avec un objet », « Faire apparaître une créature »… proposent ce contenu dans leur liste.
            Renommer un contenu ne casse pas les nœuds qui l’utilisent.
          </p>
        </Section>
      </aside>
    </div>
  )
}
