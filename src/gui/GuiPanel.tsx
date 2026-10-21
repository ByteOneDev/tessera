import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ColorInput, Field, NumberInput, Section, TextInput, isTyping } from '../components/ui'
import { newGui, newGuiElement } from '../project/defaults'
import { useProject, useUi } from '../project/store'
import type { ButtonAction, Gui, GuiElement, GuiElementType } from '../project/types'
import { downloadZip, pickFile, readAsDataUrl } from '../lib/files'
import { exportFancyMenu } from '../codegen/fancymenu'
import { slug } from '../codegen/names'

const TYPE_LABEL: Record<GuiElementType, string> = {
  button: 'Bouton',
  label: 'Texte',
  panel: 'Panneau',
  image: 'Image',
}

const ACTION_LABEL: Record<ButtonAction['kind'], string> = {
  none: 'Aucune',
  close: "Fermer l'écran",
  command: 'Envoyer une commande',
  message: 'Afficher un message',
  open_gui: 'Ouvrir un autre écran',
  open_link: 'Ouvrir un lien',
  quit_game: 'Quitter le jeu',
}

const ACTIONS_BY_TARGET: Record<Gui['target'], ButtonAction['kind'][]> = {
  mod: ['none', 'close', 'command', 'message', 'open_gui', 'open_link', 'quit_game'],
  fancymenu: ['none', 'command', 'message', 'open_link', 'quit_game'],
}

function defaultAction(kind: ButtonAction['kind']): ButtonAction {
  switch (kind) {
    case 'command':
      return { kind, command: 'time set day' }
    case 'message':
      return { kind, text: 'Bonjour !' }
    case 'open_gui':
      return { kind, guiId: '' }
    case 'open_link':
      return { kind, url: 'https://' }
    default:
      return { kind }
  }
}

function elementStyle(el: GuiElement, zoom: number): CSSProperties {
  const base: CSSProperties = {
    position: 'absolute',
    left: el.x * zoom,
    top: el.y * zoom,
    width: el.w * zoom,
    height: el.h * zoom,
  }
  switch (el.type) {
    case 'button':
      return {
        ...base,
        background: 'linear-gradient(#8a8a8a, #6c6c6c)',
        border: `${zoom}px solid #000`,
        boxShadow: `inset ${zoom}px ${zoom}px 0 #aaa, inset -${zoom}px -${zoom}px 0 #555`,
        color: el.color,
        display: 'grid',
        placeItems: 'center',
        fontSize: 8 * zoom,
        textShadow: `${zoom}px ${zoom}px 0 #3f3f3f`,
      }
    case 'label':
      return {
        ...base,
        color: el.color,
        fontSize: 8 * zoom,
        lineHeight: `${9 * zoom}px`,
        whiteSpace: 'nowrap',
        textShadow: el.textShadow ? `${zoom}px ${zoom}px 0 rgba(0,0,0,.5)` : undefined,
      }
    case 'panel':
      return { ...base, background: el.color }
    case 'image':
      return el.image
        ? { ...base, backgroundImage: `url(${el.image})`, backgroundSize: '100% 100%', imageRendering: 'pixelated' }
        : { ...base, border: `1px dashed #999`, display: 'grid', placeItems: 'center', color: '#bbb', fontSize: 11 }
  }
}

export function GuiPanel() {
  const guis = useProject((s) => s.project.guis)
  const update = useProject((s) => s.update)
  const { guiId, elementId, set } = useUi()
  const gui = guis.find((g) => g.id === guiId) ?? guis[0] ?? null
  const el = gui?.elements.find((e) => e.id === elementId) ?? null
  const [zoom, setZoom] = useState(3)
  const stageRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; mode: 'move' | 'resize'; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null>(null)

  const updateGui = (fn: (g: Gui) => void) =>
    update((p) => {
      const g = p.guis.find((x) => x.id === gui?.id)
      if (g) fn(g)
    })
  const updateEl = (id: string, fn: (e: GuiElement) => void) =>
    updateGui((g) => {
      const e = g.elements.find((x) => x.id === id)
      if (e) fn(e)
    })

  useEffect(() => {
    // Plus grand zoom entier qui fait tenir l'interface dans la zone de travail.
    const rect = stageRef.current?.getBoundingClientRect()
    if (!gui || !rect) return
    const fit = Math.floor(Math.min((rect.width - 80) / gui.width, (rect.height - 110) / gui.height))
    setZoom(Math.max(1, Math.min(4, fit)))
  }, [gui?.id, gui?.target]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current
      if (!d) return
      const dx = Math.round((e.clientX - d.sx) / zoom)
      const dy = Math.round((e.clientY - d.sy) / zoom)
      updateEl(d.id, (el) => {
        if (d.mode === 'move') {
          el.x = d.ox + dx
          el.y = d.oy + dy
        } else {
          el.w = Math.max(1, d.ow + dx)
          el.h = Math.max(1, d.oh + dy)
        }
      })
    }
    const onUp = () => (drag.current = null)
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || useUi.getState().panel !== 'gui') return
      const sel = useUi.getState().elementId
      if (!sel) return
      const step = e.shiftKey ? 10 : 1
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }
      if (moves[e.key]) {
        e.preventDefault()
        updateEl(sel, (el) => {
          el.x += moves[e.key][0]
          el.y += moves[e.key][1]
        })
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        updateGui((g) => void (g.elements = g.elements.filter((x) => x.id !== sel)))
        set({ elementId: null })
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey)
    }
  })

  const startDrag = (e: React.PointerEvent, item: GuiElement, mode: 'move' | 'resize') => {
    e.stopPropagation()
    e.preventDefault()
    set({ elementId: item.id })
    drag.current = { id: item.id, mode, sx: e.clientX, sy: e.clientY, ox: item.x, oy: item.y, ow: item.w, oh: item.h }
  }

  const addElement = (type: GuiElementType) => {
    if (!gui) return
    const e = newGuiElement(type, 10, 10)
    e.name = `${type}_${gui.elements.filter((x) => x.type === type).length + 1}`
    updateGui((g) => void g.elements.push(e))
    set({ elementId: e.id })
  }

  const reorder = (dir: -1 | 1) => {
    if (!el) return
    updateGui((g) => {
      const i = g.elements.findIndex((x) => x.id === el.id)
      const j = i + dir
      if (j < 0 || j >= g.elements.length) return
      ;[g.elements[i], g.elements[j]] = [g.elements[j], g.elements[i]]
    })
  }

  const exportFancy = async () => {
    if (!gui) return
    const out = exportFancyMenu(gui)
    await downloadZip(
      [{ path: out.layoutPath, content: out.layout }, ...out.assets.map((a) => ({ path: a.path, content: '', dataUrl: a.dataUrl }))],
      `${slug(gui.name, 'layout')}_fancymenu.zip`,
    )
  }

  return (
    <div className="panel">
      <aside className="side">
        <Section title="Interfaces">
          <div className="row" style={{ marginBottom: 8 }}>
            <button
              style={{ flex: 1 }}
              onClick={() => {
                const g = newGui(`ecran_${guis.length + 1}`, 'mod')
                update((p) => void p.guis.push(g))
                set({ guiId: g.id, elementId: null })
              }}
              title="Nouvel écran de mod"
            >
              + Écran mod
            </button>
            <button
              style={{ flex: 1 }}
              onClick={() => {
                const g = newGui(`menu_${guis.length + 1}`, 'fancymenu')
                update((p) => void p.guis.push(g))
                set({ guiId: g.id, elementId: null })
              }}
              title="Nouvelle mise en page FancyMenu"
            >
              + FancyMenu
            </button>
          </div>
          <div className="list">
            {guis.map((g) => (
              <div
                key={g.id}
                className={'list-item' + (g.id === gui?.id ? ' selected' : '')}
                onClick={() => set({ guiId: g.id, elementId: null })}
              >
                <span className="grow">{g.name}</span>
                <span className="tag">{g.target === 'mod' ? 'Mod' : 'FancyMenu'}</span>
              </div>
            ))}
          </div>
        </Section>
        {gui && (
          <>
            <Section title="Ajouter">
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {(Object.keys(TYPE_LABEL) as GuiElementType[]).map((t) => (
                  <button key={t} onClick={() => addElement(t)}>
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </Section>
            <Section title="Éléments">
              <div className="list">
                {gui.elements.map((e) => (
                  <div
                    key={e.id}
                    className={'list-item' + (e.id === el?.id ? ' selected' : '')}
                    onClick={() => set({ elementId: e.id })}
                  >
                    <span className="grow">{e.name}</span>
                    <span className="tag">{TYPE_LABEL[e.type]}</span>
                  </div>
                ))}
              </div>
              <p className="hint">Les éléments du bas de la liste sont dessinés par-dessus.</p>
            </Section>
          </>
        )}
      </aside>

      <div ref={stageRef} className="stage" style={{ background: '#121418' }} onPointerDown={() => set({ elementId: null })}>
        {gui ? (
          <>
            <div className="toolbar">
              <div className="seg">
                {[1, 2, 3, 4].map((z) => (
                  <button key={z} className={z === zoom ? 'active' : ''} onClick={() => setZoom(z)} onPointerDown={(e) => e.stopPropagation()}>
                    {z}×
                  </button>
                ))}
              </div>
              <div className="spacer" />
              {gui.target === 'fancymenu' ? (
                <button className="primary" onClick={exportFancy} onPointerDown={(e) => e.stopPropagation()}>
                  Exporter pour FancyMenu
                </button>
              ) : (
                <button
                  className="primary"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => useUi.getState().set({ panel: 'code', codeFile: `screen:${gui.id}` })}
                >
                  Voir le code Java
                </button>
              )}
            </div>
            <div style={{ position: 'absolute', inset: 0, overflow: 'auto', display: 'flex', padding: '60px 40px 40px' }}>
              <div
                style={{
                  position: 'relative',
                  margin: 'auto',
                  width: gui.width * zoom,
                  height: gui.height * zoom,
                  flex: 'none',
                  outline: '1px solid #3a404c',
                  background:
                    gui.target === 'fancymenu'
                      ? 'linear-gradient(#2c3e5c, #1a2333)'
                      : 'repeating-conic-gradient(#1c1f25 0 25%, #20242b 0 50%) 0 0 / 16px 16px',
                  fontFamily: 'var(--mono)',
                }}
              >
                {gui.elements.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      ...elementStyle(item, zoom),
                      outline: item.id === el?.id ? '2px solid var(--accent)' : undefined,
                      cursor: 'move',
                      userSelect: 'none',
                    }}
                    onPointerDown={(e) => startDrag(e, item, 'move')}
                  >
                    {item.type === 'button' || item.type === 'label' ? item.text : item.type === 'image' && !item.image ? 'Image' : null}
                    {item.id === el?.id && (
                      <div
                        onPointerDown={(e) => startDrag(e, item, 'resize')}
                        style={{
                          position: 'absolute',
                          right: -5,
                          bottom: -5,
                          width: 10,
                          height: 10,
                          background: 'var(--accent)',
                          cursor: 'nwse-resize',
                          borderRadius: 2,
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="empty">Créez une interface pour commencer.</div>
        )}
      </div>

      <aside className="side right">
        {gui && !el && (
          <Section
            title="Interface"
            actions={
              <button
                className="danger"
                onClick={() => {
                  update((p) => void (p.guis = p.guis.filter((g) => g.id !== gui.id)))
                  set({ guiId: null, elementId: null })
                }}
              >
                Supprimer
              </button>
            }
          >
            <Field label="Nom">
              <TextInput value={gui.name} onChange={(v) => updateGui((g) => void (g.name = v))} />
            </Field>
            <Field label="Destination">
              <select value={gui.target} onChange={(e) => updateGui((g) => void (g.target = e.target.value as Gui['target']))}>
                <option value="mod">Écran du mod (Java)</option>
                <option value="fancymenu">Mise en page FancyMenu</option>
              </select>
            </Field>
            {gui.target === 'fancymenu' && (
              <Field label="Écran personnalisé">
                <select value={gui.fancyMenuScreen} onChange={(e) => updateGui((g) => void (g.fancyMenuScreen = e.target.value))}>
                  <option value="title_screen">Menu principal</option>
                  <option value="pause_screen">Menu pause</option>
                  <option value="select_world_screen">Sélection du monde</option>
                  <option value="join_multiplayer_screen">Multijoueur</option>
                  <option value="options_screen">Options</option>
                </select>
              </Field>
            )}
            <div className="row">
              <Field label="Largeur">
                <NumberInput value={gui.width} min={16} onChange={(v) => updateGui((g) => void (g.width = Math.round(v)))} />
              </Field>
              <Field label="Hauteur">
                <NumberInput value={gui.height} min={16} onChange={(v) => updateGui((g) => void (g.height = Math.round(v)))} />
              </Field>
            </div>
            <p className="hint">
              {gui.target === 'mod'
                ? 'Dimensions en pixels d’interface Minecraft. L’écran est centré en jeu. Ouvrez-le avec le nœud « Ouvrir un écran ».'
                : 'Export expérimental : le format FancyMenu 3 doit encore être validé sur une vraie installation. Les positions sont relatives au coin haut-gauche.'}
            </p>
          </Section>
        )}
        {gui && el && (
          <Section
            title={TYPE_LABEL[el.type]}
            actions={
              <>
                <button onClick={() => reorder(-1)} title="Descendre d’un plan">
                  ↓
                </button>
                <button onClick={() => reorder(1)} title="Monter d’un plan">
                  ↑
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    updateGui((g) => void (g.elements = g.elements.filter((x) => x.id !== el.id)))
                    set({ elementId: null })
                  }}
                >
                  Supprimer
                </button>
              </>
            }
          >
            <Field label="Nom">
              <TextInput value={el.name} onChange={(v) => updateEl(el.id, (e) => void (e.name = v))} />
            </Field>
            <div className="row">
              <Field label="X">
                <NumberInput value={el.x} onChange={(v) => updateEl(el.id, (e) => void (e.x = Math.round(v)))} />
              </Field>
              <Field label="Y">
                <NumberInput value={el.y} onChange={(v) => updateEl(el.id, (e) => void (e.y = Math.round(v)))} />
              </Field>
            </div>
            <div className="row">
              <Field label="Largeur">
                <NumberInput value={el.w} min={1} onChange={(v) => updateEl(el.id, (e) => void (e.w = Math.round(v)))} />
              </Field>
              <Field label="Hauteur">
                <NumberInput value={el.h} min={1} onChange={(v) => updateEl(el.id, (e) => void (e.h = Math.round(v)))} />
              </Field>
            </div>
            {(el.type === 'button' || el.type === 'label') && (
              <Field label="Texte">
                <TextInput value={el.text} onChange={(v) => updateEl(el.id, (e) => void (e.text = v))} />
              </Field>
            )}
            {el.type !== 'image' && (
              <Field label={el.type === 'panel' ? 'Couleur' : 'Couleur du texte'}>
                <ColorInput value={el.color} onChange={(v) => updateEl(el.id, (e) => void (e.color = v))} />
              </Field>
            )}
            {el.type === 'label' && (
              <label className="row" style={{ marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={el.textShadow}
                  onChange={(ev) => updateEl(el.id, (e) => void (e.textShadow = ev.target.checked))}
                />
                Ombre du texte
              </label>
            )}
            {el.type === 'image' && (
              <Field label="Image PNG">
                <button
                  onClick={async () => {
                    const f = await pickFile('image/png')
                    if (f) {
                      const url = await readAsDataUrl(f)
                      updateEl(el.id, (e) => void (e.image = url))
                    }
                  }}
                >
                  {el.image ? 'Remplacer l’image' : 'Choisir une image'}
                </button>
              </Field>
            )}
            {el.type === 'button' && (
              <>
                <Field label="Action au clic">
                  <select
                    value={el.action.kind}
                    onChange={(ev) => updateEl(el.id, (e) => void (e.action = defaultAction(ev.target.value as ButtonAction['kind'])))}
                  >
                    {ACTIONS_BY_TARGET[gui.target].map((k) => (
                      <option key={k} value={k}>
                        {ACTION_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </Field>
                {el.action.kind === 'command' && (
                  <Field label="Commande">
                    <TextInput
                      value={el.action.command}
                      onChange={(v) => updateEl(el.id, (e) => void (e.action = { kind: 'command', command: v }))}
                    />
                  </Field>
                )}
                {el.action.kind === 'message' && (
                  <Field label="Message">
                    <TextInput
                      value={el.action.text}
                      onChange={(v) => updateEl(el.id, (e) => void (e.action = { kind: 'message', text: v }))}
                    />
                  </Field>
                )}
                {el.action.kind === 'open_link' && (
                  <Field label="Adresse">
                    <TextInput
                      value={el.action.url}
                      onChange={(v) => updateEl(el.id, (e) => void (e.action = { kind: 'open_link', url: v }))}
                    />
                  </Field>
                )}
                {el.action.kind === 'open_gui' && (
                  <Field label="Écran">
                    <select
                      value={el.action.guiId}
                      onChange={(ev) => updateEl(el.id, (e) => void (e.action = { kind: 'open_gui', guiId: ev.target.value }))}
                    >
                      <option value="">— choisir —</option>
                      {guis
                        .filter((g) => g.target === 'mod' && g.id !== gui.id)
                        .map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                )}
              </>
            )}
            <p className="hint">Flèches : déplacer d’un pixel (Maj : 10). Suppr : supprimer.</p>
          </Section>
        )}
        {!gui && (
          <Section title="Interface">
            <p className="hint">Aucune interface.</p>
          </Section>
        )}
      </aside>
    </div>
  )
}
