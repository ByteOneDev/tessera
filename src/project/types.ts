// Modèle de données d'un projet Tessera (sérialisé dans tessera.json).
// Unités du modeleur : pixels Blockbench (16 px = 1 bloc).

export type Vec3 = [number, number, number]

export interface Cube {
  id: string
  name: string
  from: Vec3
  size: Vec3
  /** Point de pivot pour la rotation. */
  origin: Vec3
  /** Rotation en degrés autour du pivot. */
  rotation: Vec3
  color: string
}

export interface Model {
  id: string
  name: string
  cubes: Cube[]
}

export type GuiTarget = 'mod' | 'fancymenu'
export type GuiElementType = 'button' | 'label' | 'panel' | 'image'

export type ButtonAction =
  | { kind: 'none' }
  | { kind: 'close' }
  | { kind: 'command'; command: string }
  | { kind: 'message'; text: string }
  | { kind: 'open_gui'; guiId: string }
  | { kind: 'open_link'; url: string }
  | { kind: 'quit_game' }

export interface GuiElement {
  id: string
  type: GuiElementType
  name: string
  x: number
  y: number
  w: number
  h: number
  text: string
  color: string
  textShadow: boolean
  /** Image en data URL (PNG) pour les éléments `image`. */
  image?: string
  action: ButtonAction
}

export interface Gui {
  id: string
  name: string
  target: GuiTarget
  /** Pour FancyMenu : identifiant de l'écran (ex. title_screen). */
  fancyMenuScreen: string
  width: number
  height: number
  elements: GuiElement[]
}

export interface LogicNode {
  id: string
  type: string
  position: { x: number; y: number }
  params: Record<string, string>
}

export interface LogicEdge {
  id: string
  source: string
  sourceHandle: string
  target: string
  targetHandle: string
}

export interface ModMeta {
  modId: string
  name: string
  version: string
  authors: string
  description: string
}

export interface Project {
  format: 'tessera'
  formatVersion: 1
  meta: ModMeta
  models: Model[]
  guis: Gui[]
  logic: { nodes: LogicNode[]; edges: LogicEdge[] }
  /** Code Java libre ajouté au mod (classe CustomCode). */
  customCode: string
}
