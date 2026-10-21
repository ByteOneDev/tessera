import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { Section } from '../components/ui'
import { generateLogic } from '../codegen/logic'
import { newId } from '../project/defaults'
import { useProject, useUi } from '../project/store'
import { CATEGORY_LABEL, NODE_DEFS, NODE_DEF_BY_TYPE, defaultParams, type NodeCategory } from './nodeDefs'
import { DiagnosticsContext, TesseraNode } from './TesseraNode'

const nodeTypes = { tessera: TesseraNode }
const DND_TYPE = 'application/x-tessera-node'

function Flow() {
  const logic = useProject((s) => s.project.logic)
  const project = useProject((s) => s.project)
  const update = useProject((s) => s.update)
  const { screenToFlowPosition, setCenter, getNode } = useReactFlow()
  const diagnostics = useMemo(() => generateLogic(project).diagnostics, [project])
  const [filter, setFilter] = useState('')

  // État local React Flow (dimensions mesurées, sélection) synchronisé avec le projet.
  const [rfNodes, setRfNodes] = useState<Node[]>([])
  const [rfEdges, setRfEdges] = useState<Edge[]>([])
  useEffect(() => {
    setRfNodes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]))
      return logic.nodes.map((n) => ({ ...byId.get(n.id), id: n.id, type: 'tessera', position: n.position, data: {} }))
    })
  }, [logic.nodes])
  useEffect(() => {
    setRfEdges((prev) => {
      const byId = new Map(prev.map((e) => [e.id, e]))
      return logic.edges.map((e) => ({
        ...byId.get(e.id),
        id: e.id,
        source: e.source,
        sourceHandle: e.sourceHandle,
        target: e.target,
        targetHandle: e.targetHandle,
        className: `exec-edge ${e.sourceHandle}`,
      }))
    })
  }, [logic.edges])

  const onNodesChange = (changes: NodeChange[]) => {
    setRfNodes((nds) => applyNodeChanges(changes, nds))
    const removed = new Set(changes.flatMap((c) => (c.type === 'remove' ? [c.id] : [])))
    const moved = changes.flatMap((c) => (c.type === 'position' && c.position ? [c] : []))
    if (!removed.size && !moved.length) return
    update((p) => {
      for (const c of moved) {
        const n = p.logic.nodes.find((x) => x.id === c.id)
        if (n && c.position) n.position = { x: Math.round(c.position.x), y: Math.round(c.position.y) }
      }
      if (removed.size) {
        p.logic.nodes = p.logic.nodes.filter((n) => !removed.has(n.id))
        p.logic.edges = p.logic.edges.filter((e) => !removed.has(e.source) && !removed.has(e.target))
      }
    })
  }

  const onEdgesChange = (changes: EdgeChange[]) => {
    setRfEdges((eds) => applyEdgeChanges(changes, eds))
    const removed = new Set(changes.flatMap((c) => (c.type === 'remove' ? [c.id] : [])))
    if (removed.size) update((p) => void (p.logic.edges = p.logic.edges.filter((e) => !removed.has(e.id))))
  }

  const onConnect = (c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return
    update((p) => {
      const exists = p.logic.edges.some(
        (e) => e.source === c.source && e.sourceHandle === (c.sourceHandle ?? 'out') && e.target === c.target,
      )
      if (!exists) {
        p.logic.edges.push({
          id: newId(),
          source: c.source,
          sourceHandle: c.sourceHandle ?? 'out',
          target: c.target,
          targetHandle: c.targetHandle ?? 'in',
        })
      }
    })
  }

  const addNode = (type: string, position?: { x: number; y: number }) => {
    const def = NODE_DEF_BY_TYPE[type]
    let pos = position
    if (!pos) {
      // Centre du canevas, décalé tant qu'un nœud occupe déjà la place.
      const rect = document.querySelector('.react-flow')?.getBoundingClientRect()
      pos = screenToFlowPosition(
        rect ? { x: rect.left + rect.width / 2 - 100, y: rect.top + rect.height / 2 - 40 } : { x: innerWidth / 2, y: innerHeight / 2 },
      )
      const taken = (x: number, y: number) => logic.nodes.some((n) => Math.abs(n.position.x - x) < 24 && Math.abs(n.position.y - y) < 24)
      while (taken(pos.x, pos.y)) pos = { x: pos.x + 32, y: pos.y + 32 }
    }
    const at = pos
    update((p) =>
      void p.logic.nodes.push({ id: newId(), type, position: { x: Math.round(at.x), y: Math.round(at.y) }, params: defaultParams(def) }),
    )
  }

  const onDrop = (e: DragEvent) => {
    const type = e.dataTransfer.getData(DND_TYPE)
    if (!type) return
    e.preventDefault()
    addNode(type, screenToFlowPosition({ x: e.clientX, y: e.clientY }))
  }

  const focusNode = (id?: string) => {
    const n = id ? getNode(id) : undefined
    if (!n) return
    setCenter(n.position.x + (n.measured?.width ?? 200) / 2, n.position.y + (n.measured?.height ?? 80) / 2, { zoom: 1.1, duration: 300 })
    setRfNodes((nds) => nds.map((x) => ({ ...x, selected: x.id === id })))
  }

  const q = filter.trim().toLowerCase()
  const categories: NodeCategory[] = ['event', 'condition', 'action']
  const errors = diagnostics.filter((d) => d.level === 'error')
  const warnings = diagnostics.filter((d) => d.level === 'warning')

  return (
    <div className="panel">
      <aside className="side">
        <div className="section">
          <input placeholder="Rechercher un nœud…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        {categories.map((cat) => {
          const defs = NODE_DEFS.filter((d) => d.category === cat && (!q || d.label.toLowerCase().includes(q)))
          if (!defs.length) return null
          return (
            <Section key={cat} title={CATEGORY_LABEL[cat]}>
              <div className="list">
                {defs.map((d) => (
                  <div
                    key={d.type}
                    className={`list-item palette ${cat}`}
                    draggable
                    title={d.description}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DND_TYPE, d.type)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onDoubleClick={() => addNode(d.type)}
                  >
                    <span className="swatch" />
                    <span className="grow">{d.label}</span>
                  </div>
                ))}
              </div>
            </Section>
          )
        })}
        <div className="section">
          <p className="hint">Glissez un nœud sur le canevas (ou double-cliquez). Reliez les sorties aux entrées pour définir l’ordre d’exécution.</p>
        </div>
      </aside>

      <div className="stage" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <DiagnosticsContext.Provider value={diagnostics}>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={(c) => c.source !== c.target}
            deleteKeyCode={['Delete', 'Backspace']}
            colorMode="dark"
            fitView
            fitViewOptions={{ maxZoom: 1.1 }}
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#3a404c" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable maskColor="rgba(10,12,16,.6)" nodeColor={(n) => categoryColor(n.id)} />
          </ReactFlow>
        </DiagnosticsContext.Provider>
        <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
          <div className="spacer" />
          <button className="primary" onClick={() => useUi.getState().set({ panel: 'code', codeFile: 'logic' })}>
            Voir le code Java
          </button>
        </div>
      </div>

      <aside className="side right">
        <Section title={`Vérification (${errors.length} erreur${errors.length > 1 ? 's' : ''})`}>
          {diagnostics.length === 0 && <p className="hint">Tout est bon : la logique peut être exportée.</p>}
          {[...errors, ...warnings].map((d, i) => (
            <div key={i} className={`diag ${d.level}`} onClick={() => focusNode(d.nodeId)}>
              <span className="dot" />
              <span>{d.message}</span>
            </div>
          ))}
        </Section>
        <Section title="Côté serveur / client">
          <p className="hint">
            Minecraft sépare le serveur (le monde, les inventaires) et le client (l’écran, les touches). Tessera place
            chaque action du bon côté et vous prévient si une action ne peut pas suivre un événement.
          </p>
        </Section>
      </aside>
    </div>
  )

  function categoryColor(id: string) {
    const n = logic.nodes.find((x) => x.id === id)
    const cat = n ? NODE_DEF_BY_TYPE[n.type]?.category : undefined
    return cat === 'event' ? '#c4573a' : cat === 'condition' ? '#b88a2c' : '#3b78c4'
  }
}

export function NodesPanel() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  )
}
