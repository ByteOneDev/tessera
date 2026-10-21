import { Canvas } from '@react-three/fiber'
import { Edges, GizmoHelper, GizmoViewport, Grid, OrbitControls, TransformControls } from '@react-three/drei'
import { useState } from 'react'
import * as THREE from 'three'
import type { Cube, Model, Vec3 } from '../project/types'

export type TransformMode = 'translate' | 'rotate'

const DEG = Math.PI / 180

interface Props {
  model: Model
  selectedId: string | null
  mode: TransformMode
  onSelect: (id: string | null) => void
  /** Déplacement : décale `from` et le pivot ensemble. */
  onMove: (id: string, delta: Vec3) => void
  onRotate: (id: string, rotation: Vec3) => void
}

function CubeMesh({
  cube,
  selected,
  onSelect,
  groupRef,
}: {
  cube: Cube
  selected: boolean
  onSelect: () => void
  groupRef?: (g: THREE.Group | null) => void
}) {
  const center: Vec3 = [
    cube.from[0] + cube.size[0] / 2 - cube.origin[0],
    cube.from[1] + cube.size[1] / 2 - cube.origin[1],
    cube.from[2] + cube.size[2] / 2 - cube.origin[2],
  ]
  return (
    <group
      ref={groupRef}
      position={cube.origin}
      rotation={new THREE.Euler(cube.rotation[0] * DEG, cube.rotation[1] * DEG, cube.rotation[2] * DEG, 'ZYX')}
    >
      <mesh
        position={center}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
      >
        <boxGeometry args={[Math.max(cube.size[0], 0.01), Math.max(cube.size[1], 0.01), Math.max(cube.size[2], 0.01)]} />
        <meshStandardMaterial color={cube.color} roughness={0.9} />
        <Edges color={selected ? '#ffffff' : '#000000'} lineWidth={selected ? 2 : 1} threshold={15} />
      </mesh>
    </group>
  )
}

export function Viewport({ model, selectedId, mode, onSelect, onMove, onRotate }: Props) {
  const [target, setTarget] = useState<THREE.Group | null>(null)
  const selected = model.cubes.find((c) => c.id === selectedId) ?? null

  return (
    <Canvas
      camera={{ position: [38, 36, 46], fov: 45, near: 0.1, far: 2000 }}
      onPointerMissed={() => onSelect(null)}
      style={{ background: '#1b1e24' }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[30, 50, 20]} intensity={1.1} />
      <directionalLight position={[-30, 20, -30]} intensity={0.35} />
      <Grid
        args={[64, 64]}
        cellSize={1}
        sectionSize={16}
        cellColor="#2b303a"
        sectionColor="#4a5260"
        fadeDistance={160}
        infiniteGrid
      />
      {model.cubes.map((cube) => (
        <CubeMesh
          key={cube.id}
          cube={cube}
          selected={cube.id === selectedId}
          onSelect={() => onSelect(cube.id)}
          groupRef={cube.id === selectedId ? setTarget : undefined}
        />
      ))}
      {selected && target && (
        <TransformControls
          object={target}
          mode={mode}
          translationSnap={1}
          rotationSnap={7.5 * DEG}
          size={0.8}
          onObjectChange={() => {
            if (mode === 'translate') {
              const p = target.position
              const next: Vec3 = [Math.round(p.x), Math.round(p.y), Math.round(p.z)]
              const delta: Vec3 = [
                next[0] - selected.origin[0],
                next[1] - selected.origin[1],
                next[2] - selected.origin[2],
              ]
              if (delta.some((d) => d !== 0)) onMove(selected.id, delta)
            } else {
              const e = new THREE.Euler().setFromQuaternion(target.quaternion, 'ZYX')
              const r = (v: number) => Math.round((v / DEG) * 10) / 10
              onRotate(selected.id, [r(e.x), r(e.y), r(e.z)])
            }
          }}
        />
      )}
      <OrbitControls makeDefault target={[0, 12, 0]} />
      <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
        <GizmoViewport axisColors={['#e5534b', '#5fb760', '#3b78c4']} labelColor="#fff" />
      </GizmoHelper>
    </Canvas>
  )
}
