import { nanoid } from 'nanoid'
import { Bitmap } from '../lib/png'
import type {
  Content,
  ContentKind,
  Cube,
  EntityContent,
  Gui,
  GuiElement,
  GuiElementType,
  ItemContent,
  LogicEdge,
  LogicNode,
  ModMeta,
  Model,
  Project,
} from './types'

export const newId = () => nanoid(10)

export function newCube(partial: Partial<Cube> = {}): Cube {
  return {
    id: newId(),
    name: 'cube',
    from: [-4, 0, -4],
    size: [8, 8, 8],
    origin: [0, 0, 0],
    rotation: [0, 0, 0],
    color: '#c98a4b',
    ...partial,
  }
}

export function newModel(name = 'nouveau_modele'): Model {
  return {
    id: newId(),
    name,
    cubes: [
      newCube({ name: 'corps', from: [-4, 12, -2], size: [8, 12, 4], origin: [0, 24, 0], color: '#3b82c4' }),
      newCube({ name: 'tete', from: [-4, 24, -4], size: [8, 8, 8], origin: [0, 24, 0], color: '#e0b48a' }),
      newCube({ name: 'jambe_g', from: [-4, 0, -2], size: [4, 12, 4], origin: [-2, 12, 0], color: '#2f3f6b' }),
      newCube({ name: 'jambe_d', from: [0, 0, -2], size: [4, 12, 4], origin: [2, 12, 0], color: '#2f3f6b' }),
    ],
  }
}

const ELEMENT_DEFAULTS: Record<GuiElementType, Partial<GuiElement>> = {
  button: { w: 80, h: 20, text: 'Bouton', color: '#ffffff' },
  label: { w: 80, h: 10, text: 'Texte', color: '#404040' },
  panel: { w: 60, h: 40, text: '', color: '#8b8b8b' },
  image: { w: 32, h: 32, text: '', color: '#ffffff' },
}

export function newGuiElement(type: GuiElementType, x = 10, y = 10): GuiElement {
  return {
    id: newId(),
    type,
    name: type,
    x,
    y,
    w: 40,
    h: 20,
    text: '',
    color: '#ffffff',
    textShadow: false,
    action: { kind: 'none' },
    ...ELEMENT_DEFAULTS[type],
  }
}

export function newGui(name = 'nouvel_ecran', target: Gui['target'] = 'mod'): Gui {
  const isFancy = target === 'fancymenu'
  return {
    id: newId(),
    name,
    target,
    fancyMenuScreen: 'title_screen',
    width: isFancy ? 427 : 176,
    height: isFancy ? 240 : 166,
    elements: isFancy
      ? []
      : [
          { ...newGuiElement('panel', 0, 0), name: 'fond', w: 176, h: 166, color: '#c6c6c6' },
          { ...newGuiElement('label', 8, 6), name: 'titre', text: 'Mon écran' },
          { ...newGuiElement('button', 48, 130), name: 'fermer', text: 'Fermer', action: { kind: 'close' } },
        ],
  }
}

const META: ModMeta = {
  modId: 'monmod',
  name: 'Mon Mod',
  version: '1.0.0',
  authors: '',
  description: 'Un mod créé avec Tessera.',
}

export function newContent(kind: ContentKind, name: string, modelId = ''): Content {
  switch (kind) {
    case 'item':
      return { id: newId(), kind, name, maxStack: 64 }
    case 'block':
      return { id: newId(), kind, name, hardness: 1.5 }
    case 'entity':
      return { id: newId(), kind, name, modelId, health: 10, speed: 0.25, eggPrimary: '#3b82c4', eggSecondary: '#e0b48a' }
  }
}

/** Gemme 16×16 dessinée pixel par pixel (texture d'exemple). */
function gemTexture(): string {
  const bmp = new Bitmap(16, 16)
  const rows = ['......XXXX......', '....XXLLLLXX....', '...XLLWWLLLLX...', '..XLLWWLLLLLLX..', '..XLLWLLLLLLMX..', '.XLLLLLLLLLLMMX.', '.XLLLLLLLLLMMMX.', '.XMLLLLLLLMMMMX.', '.XMMLLLLLMMMMMX.', '.XMMMMLLMMMMMDX.', '..XMMMMMMMMMDX..', '..XDMMMMMMMDDX..', '...XDDMMMMDDX...', '....XXDDDDXX....', '......XXXX......', '................']
  const colors: Record<string, string> = { X: '#1f3b2c', L: '#5fe08a', W: '#e8fff0', M: '#34b866', D: '#22804a' }
  rows.forEach((row, y) => [...row].forEach((ch, x) => colors[ch] && bmp.fillRect(x, y, 1, 1, colors[ch])))
  return bmp.toDataUrl()
}

/** Projet vierge : aucun contenu. */
export function emptyProject(): Project {
  return {
    format: 'tessera',
    formatVersion: 2,
    meta: { ...META },
    models: [],
    guis: [],
    content: [],
    logic: { nodes: [], edges: [] },
    customCode: '',
  }
}

/** Modèle « Mod de bienvenue » : un exemple complet et simple qui utilise les quatre panneaux. */
export function newProject(): Project {
  const model = newModel('compagnon')
  const gem = { ...(newContent('item', 'Pierre de bienvenue') as ItemContent), texture: gemTexture() }
  const companion = newContent('entity', 'Compagnon', model.id) as EntityContent
  const gui = newGui('menu_principal')
  const n = (type: string, x: number, y: number, params: Record<string, string> = {}): LogicNode => ({
    id: newId(),
    type,
    position: { x, y },
    params,
  })
  const join = n('event.player_join', 40, 80)
  const msg = n('action.message', 340, 80, { text: 'Bienvenue sur le serveur !' })
  const give = n('action.give_item', 640, 80, { item: `content:${gem.id}`, count: '1' })
  const click = n('event.right_click_item', 40, 300, { item: `content:${gem.id}` })
  const spawn = n('action.spawn_entity', 340, 300, { entity: `content:${companion.id}` })
  const sound = n('action.sound', 640, 300, { sound: 'minecraft:entity.experience_orb.pickup' })
  const key = n('event.key_press', 40, 500, { key: 'G', name: 'Ouvrir le menu' })
  const open = n('action.open_gui', 340, 500, { gui: gui.id })
  const link = (a: LogicNode, b: LogicNode): LogicEdge => ({ id: newId(), source: a.id, sourceHandle: 'out', target: b.id, targetHandle: 'in' })
  return {
    ...emptyProject(),
    models: [model],
    guis: [gui],
    content: [gem, companion],
    logic: {
      nodes: [join, msg, give, click, spawn, sound, key, open],
      edges: [link(join, msg), link(msg, give), link(click, spawn), link(spawn, sound), link(key, open)],
    },
  }
}

export const TEMPLATES = [
  {
    id: 'welcome',
    name: 'Mod de bienvenue',
    description: 'Message et objet à la connexion, une pierre qui invoque un compagnon, un menu ouvert avec la touche G.',
    create: newProject,
  },
  { id: 'empty', name: 'Projet vide', description: 'Partir de zéro.', create: emptyProject },
]
