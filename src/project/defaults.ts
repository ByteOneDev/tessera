import { nanoid } from 'nanoid'
import type { Cube, Gui, GuiElement, GuiElementType, Model, Project } from './types'

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

export function newProject(): Project {
  const joinId = newId()
  const msgId = newId()
  return {
    format: 'tessera',
    formatVersion: 1,
    meta: {
      modId: 'monmod',
      name: 'Mon Mod',
      version: '1.0.0',
      authors: '',
      description: 'Un mod créé avec Tessera.',
    },
    models: [newModel('personnage')],
    guis: [newGui('menu_principal')],
    logic: {
      nodes: [
        { id: joinId, type: 'event.player_join', position: { x: 40, y: 80 }, params: {} },
        {
          id: msgId,
          type: 'action.message',
          position: { x: 340, y: 80 },
          params: { text: 'Bienvenue sur le serveur !' },
        },
      ],
      edges: [{ id: newId(), source: joinId, sourceHandle: 'out', target: msgId, targetHandle: 'in' }],
    },
    customCode: '',
  }
}
