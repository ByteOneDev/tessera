// Catalogue des nœuds de logique. La génération Java correspondante est dans codegen/javaGen.ts.

export type Side = 'server' | 'client' | 'both'
export type NodeCategory = 'event' | 'condition' | 'action'

export interface ParamDef {
  key: string
  label: string
  kind: 'text' | 'number' | 'id' | 'select' | 'code' | 'gui' | 'key'
  default: string
  placeholder?: string
  options?: { value: string; label: string }[]
}

export interface NodeDef {
  type: string
  category: NodeCategory
  label: string
  description: string
  /** Côté où l'événement se déclenche, ou côté où l'action fonctionne. */
  side: Side
  params: ParamDef[]
  outputs: { id: string; label: string }[]
}

const OUT = [{ id: 'out', label: '' }]
const BRANCHES = [
  { id: 'true', label: 'vrai' },
  { id: 'false', label: 'faux' },
]

export const NODE_DEFS: NodeDef[] = [
  // --- Événements ---
  {
    type: 'event.player_join',
    category: 'event',
    label: 'Joueur rejoint',
    description: 'Quand un joueur se connecte au monde ou au serveur.',
    side: 'server',
    params: [],
    outputs: OUT,
  },
  {
    type: 'event.player_respawn',
    category: 'event',
    label: 'Joueur réapparaît',
    description: 'Quand un joueur réapparaît après sa mort.',
    side: 'server',
    params: [],
    outputs: OUT,
  },
  {
    type: 'event.right_click_item',
    category: 'event',
    label: 'Clic droit avec un objet',
    description: 'Quand un joueur fait clic droit en tenant un objet. Se déclenche côté serveur et côté client.',
    side: 'both',
    params: [{ key: 'item', label: 'Objet (vide = tous)', kind: 'id', default: '', placeholder: 'minecraft:stick' }],
    outputs: OUT,
  },
  {
    type: 'event.block_break',
    category: 'event',
    label: 'Bloc cassé',
    description: 'Quand un joueur casse un bloc.',
    side: 'server',
    params: [{ key: 'block', label: 'Bloc (vide = tous)', kind: 'id', default: '', placeholder: 'minecraft:stone' }],
    outputs: OUT,
  },
  {
    type: 'event.entity_kill',
    category: 'event',
    label: 'Joueur tue une créature',
    description: 'Quand une créature meurt tuée par un joueur.',
    side: 'server',
    params: [],
    outputs: OUT,
  },
  {
    type: 'event.chat',
    category: 'event',
    label: 'Message dans le chat',
    description: 'Quand un joueur envoie un message dans le chat.',
    side: 'server',
    params: [{ key: 'contains', label: 'Contient (vide = tous)', kind: 'text', default: '' }],
    outputs: OUT,
  },
  {
    type: 'event.key_press',
    category: 'event',
    label: 'Touche pressée',
    description: 'Quand le joueur appuie sur une touche (configurable dans les contrôles du jeu). Côté client.',
    side: 'client',
    params: [
      { key: 'key', label: 'Touche', kind: 'key', default: 'G' },
      { key: 'name', label: 'Nom dans les contrôles', kind: 'text', default: 'Action' },
    ],
    outputs: OUT,
  },

  // --- Conditions ---
  {
    type: 'condition.sneaking',
    category: 'condition',
    label: 'Si accroupi',
    description: 'Le joueur est-il accroupi ?',
    side: 'both',
    params: [],
    outputs: BRANCHES,
  },
  {
    type: 'condition.creative',
    category: 'condition',
    label: 'Si en créatif',
    description: 'Le joueur est-il en mode créatif ?',
    side: 'both',
    params: [],
    outputs: BRANCHES,
  },
  {
    type: 'condition.holding',
    category: 'condition',
    label: 'Si tient un objet',
    description: 'Le joueur tient-il cet objet en main principale ?',
    side: 'both',
    params: [{ key: 'item', label: 'Objet', kind: 'id', default: 'minecraft:diamond' }],
    outputs: BRANCHES,
  },
  {
    type: 'condition.chance',
    category: 'condition',
    label: 'Si chance',
    description: 'Vrai avec la probabilité indiquée.',
    side: 'both',
    params: [{ key: 'percent', label: 'Probabilité (%)', kind: 'number', default: '50' }],
    outputs: BRANCHES,
  },
  {
    type: 'condition.name',
    category: 'condition',
    label: 'Si nom du joueur',
    description: 'Le pseudo du joueur est-il exactement celui-ci ?',
    side: 'both',
    params: [{ key: 'name', label: 'Pseudo', kind: 'text', default: 'Steve' }],
    outputs: BRANCHES,
  },

  // --- Actions ---
  {
    type: 'action.message',
    category: 'action',
    label: 'Envoyer un message',
    description: 'Affiche un message au joueur.',
    side: 'both',
    params: [{ key: 'text', label: 'Message', kind: 'text', default: 'Bonjour !' }],
    outputs: OUT,
  },
  {
    type: 'action.give_item',
    category: 'action',
    label: 'Donner un objet',
    description: "Ajoute un objet dans l'inventaire du joueur.",
    side: 'server',
    params: [
      { key: 'item', label: 'Objet', kind: 'id', default: 'minecraft:diamond' },
      { key: 'count', label: 'Quantité', kind: 'number', default: '1' },
    ],
    outputs: OUT,
  },
  {
    type: 'action.teleport',
    category: 'action',
    label: 'Téléporter',
    description: 'Téléporte le joueur aux coordonnées données.',
    side: 'server',
    params: [
      { key: 'x', label: 'X', kind: 'number', default: '0' },
      { key: 'y', label: 'Y', kind: 'number', default: '100' },
      { key: 'z', label: 'Z', kind: 'number', default: '0' },
    ],
    outputs: OUT,
  },
  {
    type: 'action.sound',
    category: 'action',
    label: 'Jouer un son',
    description: 'Joue un son à la position du joueur.',
    side: 'both',
    params: [{ key: 'sound', label: 'Son', kind: 'id', default: 'minecraft:entity.experience_orb.pickup' }],
    outputs: OUT,
  },
  {
    type: 'action.effect',
    category: 'action',
    label: 'Donner un effet',
    description: 'Applique un effet de potion au joueur.',
    side: 'server',
    params: [
      { key: 'effect', label: 'Effet', kind: 'id', default: 'minecraft:speed' },
      { key: 'seconds', label: 'Durée (s)', kind: 'number', default: '10' },
      { key: 'level', label: 'Niveau', kind: 'number', default: '1' },
    ],
    outputs: OUT,
  },
  {
    type: 'action.heal',
    category: 'action',
    label: 'Soigner',
    description: 'Rend des points de vie au joueur (2 = un cœur).',
    side: 'server',
    params: [{ key: 'amount', label: 'Points de vie', kind: 'number', default: '4' }],
    outputs: OUT,
  },
  {
    type: 'action.command',
    category: 'action',
    label: 'Exécuter une commande',
    description:
      "Exécute une commande. Côté serveur, elle tourne avec les droits d'opérateur ; côté client, elle est envoyée comme si le joueur la tapait.",
    side: 'both',
    params: [{ key: 'command', label: 'Commande', kind: 'text', default: 'time set day' }],
    outputs: OUT,
  },
  {
    type: 'action.open_gui',
    category: 'action',
    label: 'Ouvrir un écran',
    description: 'Ouvre un écran conçu dans le panneau Interfaces. Côté client uniquement.',
    side: 'client',
    params: [{ key: 'gui', label: 'Écran', kind: 'gui', default: '' }],
    outputs: OUT,
  },
  {
    type: 'action.java',
    category: 'action',
    label: 'Code Java',
    description: 'Insère du code Java tel quel. La variable `player` est disponible.',
    side: 'both',
    params: [{ key: 'code', label: 'Code', kind: 'code', default: '// player.setGlowingTag(true);' }],
    outputs: OUT,
  },
]

export const NODE_DEF_BY_TYPE: Record<string, NodeDef> = Object.fromEntries(NODE_DEFS.map((d) => [d.type, d]))

export const CATEGORY_LABEL: Record<NodeCategory, string> = {
  event: 'Événements',
  condition: 'Conditions',
  action: 'Actions',
}

export function defaultParams(def: NodeDef): Record<string, string> {
  return Object.fromEntries(def.params.map((p) => [p.key, p.default]))
}
