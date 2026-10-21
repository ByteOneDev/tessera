import { Handle, Position, type NodeProps } from '@xyflow/react'
import { createContext, useContext } from 'react'
import type { Diagnostic } from '../codegen/logic'
import { CONTENT_REF } from '../codegen/content'
import { useProject } from '../project/store'
import { NODE_DEF_BY_TYPE, type ParamDef } from './nodeDefs'

export const DiagnosticsContext = createContext<Diagnostic[]>([])

const KEYS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''), ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`)]

function ParamInput({ nodeId, def, value }: { nodeId: string; def: ParamDef; value: string }) {
  const update = useProject((s) => s.update)
  const guis = useProject((s) => s.project.guis)
  const content = useProject((s) => s.project.content)
  const set = (v: string) =>
    update((p) => {
      const n = p.logic.nodes.find((x) => x.id === nodeId)
      if (n) n.params[def.key] = v
    })
  switch (def.kind) {
    case 'code':
      return <textarea className="nodrag nowheel" rows={4} value={value} spellCheck={false} onChange={(e) => set(e.target.value)} />
    case 'gui':
      return (
        <select className="nodrag" value={value} onChange={(e) => set(e.target.value)}>
          <option value="">— choisir —</option>
          {guis
            .filter((g) => g.target === 'mod')
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
        </select>
      )
    case 'key':
      return (
        <select className="nodrag" value={value} onChange={(e) => set(e.target.value)}>
          {KEYS.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      )
    case 'id': {
      const choices = def.content ? content.filter((c) => def.content!.includes(c.kind)) : []
      const isRef = value.startsWith(CONTENT_REF)
      if (!choices.length && !isRef) break
      return (
        <>
          <select
            className="nodrag"
            value={isRef ? value : '__free'}
            onChange={(e) => set(e.target.value === '__free' ? '' : e.target.value)}
          >
            <optgroup label="Contenu du mod">
              {choices.map((c) => (
                <option key={c.id} value={CONTENT_REF + c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
            {isRef && !choices.some((c) => CONTENT_REF + c.id === value) && <option value={value}>⚠ contenu supprimé</option>}
            <option value="__free">Identifiant Minecraft…</option>
          </select>
          {!isRef && (
            <input className="nodrag" placeholder={def.placeholder ?? 'minecraft:…'} value={value} spellCheck={false} onChange={(e) => set(e.target.value)} />
          )}
        </>
      )
    }
    case 'select':
      return (
        <select className="nodrag" value={value} onChange={(e) => set(e.target.value)}>
          {def.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
  }
  return (
    <input
      className="nodrag"
      inputMode={def.kind === 'number' ? 'decimal' : undefined}
      placeholder={def.placeholder}
      value={value}
      spellCheck={false}
      onChange={(e) => set(e.target.value)}
    />
  )
}

export function TesseraNode({ id, selected }: NodeProps) {
  const node = useProject((s) => s.project.logic.nodes.find((n) => n.id === id))
  const diagnostics = useContext(DiagnosticsContext).filter((d) => d.nodeId === id)
  if (!node) return null
  const def = NODE_DEF_BY_TYPE[node.type]
  if (!def) return <div className="tnode error">Nœud inconnu : {node.type}</div>
  const hasError = diagnostics.some((d) => d.level === 'error')
  const hasWarning = diagnostics.length > 0

  return (
    <div className={`tnode ${def.category}${selected ? ' selected' : ''}`} title={def.description}>
      {def.category !== 'event' && <Handle type="target" position={Position.Left} id="in" className="exec" />}
      <div className="tnode-head">
        <span className="tnode-title">{def.label}</span>
        {def.side !== 'both' && <span className="tnode-side">{def.side === 'client' ? 'client' : 'serveur'}</span>}
        {hasWarning && (
          <span className={`tnode-badge ${hasError ? 'error' : 'warning'}`} title={diagnostics.map((d) => d.message).join('\n')}>
            !
          </span>
        )}
      </div>
      {def.params.length > 0 && (
        <div className="tnode-body">
          {def.params.map((p) => (
            <label key={p.key} className="tnode-param">
              <span>{p.label}</span>
              <ParamInput nodeId={id} def={p} value={node.params[p.key] ?? p.default} />
            </label>
          ))}
        </div>
      )}
      <div className="tnode-outputs">
        {def.outputs.map((o) => (
          <div key={o.id} className="tnode-output">
            <span>{o.label}</span>
            <Handle type="source" position={Position.Right} id={o.id} className={`exec ${o.id}`} />
          </div>
        ))}
      </div>
    </div>
  )
}
