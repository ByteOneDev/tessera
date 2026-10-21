// Export Blockbench (.bbmodel, format « Modded Entity », UV en boîte).
// Chaque cube devient un os (groupe) qui porte le pivot et la rotation : le modèle est prêt à animer dans Blockbench.
import type { Cube, Model } from '../project/types'

export interface UvSlot {
  cubeId: string
  u: number
  v: number
  /** Taille entière du cube, utilisée pour le dépliage UV. */
  w: number
  h: number
  d: number
}

export interface UvLayout {
  width: number
  height: number
  slots: UvSlot[]
}

const footprint = (s: UvSlot) => ({ fw: 2 * (s.w + s.d), fh: s.d + s.h })

/** Range les dépliages UV des cubes sur une texture carrée (rangement par étagères). */
export function layoutUv(cubes: Cube[]): UvLayout {
  const slots: UvSlot[] = cubes.map((c) => ({
    cubeId: c.id,
    u: 0,
    v: 0,
    w: Math.max(1, Math.ceil(c.size[0])),
    h: Math.max(1, Math.ceil(c.size[1])),
    d: Math.max(1, Math.ceil(c.size[2])),
  }))
  const order = [...slots].sort((a, b) => footprint(b).fh - footprint(a).fh)
  for (let size = 16; size <= 4096; size *= 2) {
    let x = 0
    let y = 0
    let rowH = 0
    let fits = true
    for (const s of order) {
      const { fw, fh } = footprint(s)
      if (fw > size) {
        fits = false
        break
      }
      if (x + fw > size) {
        x = 0
        y += rowH
        rowH = 0
      }
      if (y + fh > size) {
        fits = false
        break
      }
      s.u = x
      s.v = y
      x += fw
      rowH = Math.max(rowH, fh)
    }
    if (fits) return { width: size, height: size, slots }
  }
  throw new Error('Modèle trop grand pour une texture 4096×4096.')
}

type Rect = [number, number, number, number]

/** Coordonnées UV de chaque face pour un dépliage en boîte (convention Minecraft/Blockbench). */
export function boxFaces(s: UvSlot): Record<'north' | 'east' | 'south' | 'west' | 'up' | 'down', Rect> {
  const { u, v, w, h, d } = s
  return {
    east: [u, v + d, u + d, v + d + h],
    north: [u + d, v + d, u + d + w, v + d + h],
    west: [u + d + w, v + d, u + 2 * d + w, v + d + h],
    south: [u + 2 * d + w, v + d, u + 2 * d + 2 * w, v + d + h],
    up: [u + d + w, v + d, u + d, v],
    down: [u + d + 2 * w, v, u + d + w, v + d],
  }
}

export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const ch = (shift: number) => {
    const c = (n >> shift) & 255
    const out = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount)
    return Math.round(Math.min(255, Math.max(0, out)))
  }
  return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')
}

/** Peint une texture unie par cube (dessus plus clair, dessous plus sombre). Navigateur uniquement. */
export function paintTexture(model: Model, layout: UvLayout): string {
  const canvas = document.createElement('canvas')
  canvas.width = layout.width
  canvas.height = layout.height
  const ctx = canvas.getContext('2d')!
  const colorOf = new Map(model.cubes.map((c) => [c.id, c.color]))
  for (const s of layout.slots) {
    const base = colorOf.get(s.cubeId) ?? '#ffffff'
    const { u, v, w, h, d } = s
    ctx.fillStyle = base
    ctx.fillRect(u, v + d, 2 * (w + d), h)
    ctx.fillStyle = shade(base, 0.15)
    ctx.fillRect(u + d, v, w, d)
    ctx.fillStyle = shade(base, -0.2)
    ctx.fillRect(u + d + w, v, w, d)
  }
  return canvas.toDataURL('image/png')
}

const add = (a: number[], b: number[]) => a.map((x, i) => x + b[i]) as [number, number, number]

export function buildBbmodel(model: Model, layout: UvLayout, textureDataUrl: string, uuid = () => crypto.randomUUID()) {
  const slotOf = new Map(layout.slots.map((s) => [s.cubeId, s]))
  const elements: unknown[] = []
  const outliner: unknown[] = []

  for (const cube of model.cubes) {
    const slot = slotOf.get(cube.id)!
    const cubeUuid = uuid()
    const faces = Object.fromEntries(
      Object.entries(boxFaces(slot)).map(([face, uv]) => [face, { uv, texture: 0 }]),
    )
    elements.push({
      name: cube.name,
      box_uv: true,
      rescale: false,
      locked: false,
      render_order: 'default',
      allow_mirror_modeling: true,
      from: cube.from,
      to: add(cube.from, cube.size),
      autouv: 0,
      color: 0,
      origin: cube.origin,
      uv_offset: [slot.u, slot.v],
      faces,
      type: 'cube',
      uuid: cubeUuid,
    })
    outliner.push({
      name: cube.name,
      origin: cube.origin,
      rotation: cube.rotation,
      color: 0,
      uuid: uuid(),
      export: true,
      mirror_uv: false,
      isOpen: true,
      locked: false,
      visibility: true,
      autouv: 0,
      children: [cubeUuid],
    })
  }

  return {
    meta: { format_version: '4.10', model_format: 'modded_entity', box_uv: true },
    name: model.name,
    model_identifier: model.name,
    modded_entity_entity_class: '',
    modded_entity_version: '1.17',
    modded_entity_flip_y: true,
    visible_box: [1, 1, 0],
    variable_placeholders: '',
    variable_placeholder_buttons: [],
    timeline_setups: [],
    unhandled_root_fields: {},
    resolution: { width: layout.width, height: layout.height },
    elements,
    outliner,
    textures: [
      {
        path: '',
        name: `${model.name}.png`,
        folder: '',
        namespace: '',
        id: '0',
        width: layout.width,
        height: layout.height,
        uv_width: layout.width,
        uv_height: layout.height,
        particle: false,
        use_as_default: false,
        layers_enabled: false,
        render_mode: 'default',
        render_sides: 'auto',
        frame_time: 1,
        frame_order_type: 'loop',
        frame_order: '',
        frame_interpolate: false,
        visible: true,
        internal: true,
        saved: false,
        uuid: uuid(),
        source: textureDataUrl,
      },
    ],
  }
}

const IMPORT_PALETTE = ['#c98a4b', '#3b82c4', '#5fb760', '#e0b48a', '#b05bc4', '#d2a03a', '#7a8796']

interface BbElement {
  type?: string
  name?: string
  uuid?: string
  from?: number[]
  to?: number[]
  origin?: number[]
  rotation?: number[]
}
interface BbGroup {
  name?: string
  origin?: number[]
  rotation?: number[]
  children?: (string | BbGroup)[]
}

const vec = (v: number[] | undefined, fallback: Vec3Like = [0, 0, 0]): [number, number, number] =>
  v && v.length >= 3 ? [Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0] : [...fallback]
type Vec3Like = [number, number, number]

/** Importe les cubes d'un .bbmodel. Les os sans cube et l'animation sont ignorés. */
export function importBbmodel(data: unknown, name: string, newId: () => string): Model {
  const root = data as { elements?: BbElement[]; outliner?: (string | BbGroup)[]; name?: string }
  if (!root || !Array.isArray(root.elements)) throw new Error('Fichier .bbmodel invalide : aucun élément trouvé.')
  const parentOf = new Map<string, BbGroup>()
  const walk = (items: (string | BbGroup)[] | undefined, parent?: BbGroup) => {
    for (const item of items ?? []) {
      if (typeof item === 'string') {
        if (parent) parentOf.set(item, parent)
      } else walk(item.children, item)
    }
  }
  walk(root.outliner)

  const cubes: Cube[] = root.elements
    .filter((e) => (e.type ?? 'cube') === 'cube' && e.from && e.to)
    .map((e, i) => {
      const from = vec(e.from)
      const to = vec(e.to)
      const group = e.uuid ? parentOf.get(e.uuid) : undefined
      const ownRotation = vec(e.rotation)
      const useGroup = group && ownRotation.every((r) => r === 0)
      return {
        id: newId(),
        name: e.name || `cube_${i + 1}`,
        from: [Math.min(from[0], to[0]), Math.min(from[1], to[1]), Math.min(from[2], to[2])],
        size: [Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]), Math.abs(to[2] - from[2])],
        origin: useGroup ? vec(group.origin) : vec(e.origin),
        rotation: useGroup ? vec(group.rotation) : ownRotation,
        color: IMPORT_PALETTE[i % IMPORT_PALETTE.length],
      }
    })
  return { id: newId(), name: root.name || name, cubes }
}
