import { describe, expect, it } from 'vitest'
import { newGui, newModel, newProject } from '../project/defaults'
import type { LogicNode, Project } from '../project/types'
import { buildBbmodel, boxFaces, importBbmodel, layoutUv } from '../modeler/bbmodel'
import { exportFancyMenu } from './fancymenu'
import { generateLogic } from './logic'
import { buildMod } from './modProject'
import { javaString, mainClassName, pascal, resourceId } from './names'

let counter = 0
const id = () => `id${++counter}`

function projectWith(nodes: LogicNode[], edges: [string, string, string?][]): Project {
  const p = newProject()
  p.logic = {
    nodes,
    edges: edges.map(([source, target, sourceHandle = 'out']) => ({ id: id(), source, target, sourceHandle, targetHandle: 'in' })),
  }
  return p
}
const node = (nid: string, type: string, params: Record<string, string> = {}, y = 0): LogicNode => ({
  id: nid,
  type,
  position: { x: 0, y },
  params,
})

describe('names', () => {
  it('échappe les chaînes Java', () => {
    expect(javaString('il a dit "salut"\n\\')).toBe('"il a dit \\"salut\\"\\n\\\\"')
  })
  it('génère des noms de classe valides', () => {
    expect(pascal('mon écran 2')).toBe('MonEcran2')
    expect(pascal('3d')).toBe('X3d')
    expect(mainClassName({ modId: 'monmod', name: 'Mon Mod', version: '1', authors: '', description: '' })).toBe('MonMod')
    expect(mainClassName({ modId: 'abc', name: 'Super Épées', version: '1', authors: '', description: '' })).toBe('SuperEpeesMod')
  })
  it('normalise les identifiants Minecraft', () => {
    expect(resourceId('Diamond')).toEqual({ id: 'minecraft:diamond', valid: true })
    expect(resourceId('monmod:truc')).toEqual({ id: 'monmod:truc', valid: true })
    expect(resourceId('pas valide!').valid).toBe(false)
  })
})

describe('logique → Java', () => {
  it('génère le projet par défaut sans erreur', () => {
    const out = generateLogic(newProject())
    expect(out.diagnostics.filter((d) => d.level === 'error')).toEqual([])
    expect(out.modEvents).toContain('public static void onPlayerJoin(PlayerEvent.PlayerLoggedInEvent event)')
    expect(out.modEvents).toContain('player.sendSystemMessage(Component.literal("Bienvenue sur le serveur !"));')
  })

  it('génère les branches vrai/faux des conditions', () => {
    const p = projectWith(
      [
        node('e', 'event.player_join'),
        node('c', 'condition.creative'),
        node('a', 'action.message', { text: 'créatif' }),
        node('b', 'action.give_item', { item: 'diamond', count: '3' }),
      ],
      [
        ['e', 'c'],
        ['c', 'a', 'true'],
        ['c', 'b', 'false'],
      ],
    )
    const java = generateLogic(p).modEvents
    expect(java).toMatch(/if \(player\.isCreative\(\)\) \{\n\s+\/\/ Envoyer un message\n\s+player\.sendSystemMessage/)
    expect(java).toContain('} else {')
    expect(java).toContain(
      'player.getInventory().add(new ItemStack(BuiltInRegistries.ITEM.get(ResourceLocation.parse("minecraft:diamond")), 3));',
    )
  })

  it('protège les actions serveur dans un événement serveur + client', () => {
    const p = projectWith(
      [node('e', 'event.right_click_item', { item: 'stick' }), node('a', 'action.heal', { amount: '4' }), node('o', 'action.open_gui', { gui: '' })],
      [
        ['e', 'a'],
        ['a', 'o'],
      ],
    )
    p.logic.nodes[2].params.gui = p.guis[0].id
    const out = generateLogic(p)
    expect(out.diagnostics.filter((d) => d.level === 'error')).toEqual([])
    expect(out.modEvents).toContain('if (!event.getItemStack().is(BuiltInRegistries.ITEM.get(ResourceLocation.parse("minecraft:stick")))) return;')
    expect(out.modEvents).toMatch(/if \(!player\.level\(\)\.isClientSide\(\)\) \{\n\s+player\.heal\(4\.0F\);/)
    expect(out.modEvents).toMatch(/if \(player\.level\(\)\.isClientSide\(\)\) \{\n\s+ModClient\.openScreen\("MenuPrincipalScreen"\);/)
  })

  it('signale une action client après un événement serveur', () => {
    const p = projectWith([node('e', 'event.player_join'), node('o', 'action.open_gui', { gui: 'x' })], [['e', 'o']])
    const errors = generateLogic(p).diagnostics.filter((d) => d.level === 'error')
    expect(errors.some((d) => d.nodeId === 'o')).toBe(true)
  })

  it('génère les touches côté client', () => {
    const p = projectWith(
      [node('k', 'event.key_press', { key: 'h', name: 'Menu' }), node('m', 'action.message', { text: 'ok' }), node('c', 'action.command', { command: '/time set day' })],
      [
        ['k', 'm'],
        ['m', 'c'],
      ],
    )
    const out = generateLogic(p)
    expect(out.diagnostics.filter((d) => d.level === 'error')).toEqual([])
    expect(out.keys).toContain('new KeyMapping("key.monmod.action_0", GLFW.GLFW_KEY_H, CATEGORY)')
    expect(out.clientEvents).toContain('while (ModKeys.KEY_0.consumeClick()) {')
    expect(out.clientEvents).toContain('player.displayClientMessage(Component.literal("ok"), false);')
    expect(out.clientEvents).toContain('player.connection.sendCommand("time set day");')
    expect(out.langEntries['key.monmod.action_0']).toBe('Menu')
  })

  it('détecte les nombres invalides, les boucles et les nœuds isolés', () => {
    const p = projectWith(
      [node('e', 'event.player_join'), node('a', 'action.teleport', { x: 'abc', y: '1', z: '2' }), node('b', 'action.message', { text: 'x' }), node('z', 'action.heal', { amount: '1' })],
      [
        ['e', 'a'],
        ['a', 'b'],
        ['b', 'a'],
      ],
    )
    const d = generateLogic(p).diagnostics
    expect(d.some((x) => x.nodeId === 'a' && x.message.includes('Nombre invalide'))).toBe(true)
    expect(d.some((x) => x.message.includes('Boucle'))).toBe(true)
    expect(d.some((x) => x.nodeId === 'z' && x.level === 'warning')).toBe(true)
  })
})

describe('projet de mod', () => {
  it('contient tous les fichiers attendus', () => {
    const { files, diagnostics } = buildMod(newProject())
    expect(diagnostics.filter((d) => d.level === 'error')).toEqual([])
    const paths = files.map((f) => f.path)
    for (const p of [
      'build.gradle',
      'settings.gradle',
      'gradle.properties',
      'src/main/resources/META-INF/neoforge.mods.toml',
      'src/main/java/com/monmod/MonMod.java',
      'src/main/java/com/monmod/ModEvents.java',
      'src/main/java/com/monmod/client/ModClient.java',
      'src/main/java/com/monmod/client/screens/MenuPrincipalScreen.java',
      'src/main/resources/assets/monmod/lang/en_us.json',
    ]) {
      expect(paths).toContain(p)
    }
    const screen = files.find((f) => f.path.endsWith('MenuPrincipalScreen.java'))!.content
    expect(screen).toContain('Button.builder(Component.literal("Fermer"), button -> this.onClose())')
    expect(screen).toContain('graphics.fill(left + 0, top + 0, left + 0 + 176, top + 0 + 166, 0xFFC6C6C6);')
  })

  it('refuse un mod id invalide', () => {
    const p = newProject()
    p.meta.modId = 'Mon-Mod'
    expect(buildMod(p).diagnostics.some((d) => d.level === 'error')).toBe(true)
  })
})

describe('Blockbench', () => {
  it('range les UV sans chevauchement', () => {
    const model = newModel()
    const layout = layoutUv(model.cubes)
    const rects = layout.slots.map((s) => ({ x: s.u, y: s.v, w: 2 * (s.w + s.d), h: s.d + s.h }))
    for (const r of rects) {
      expect(r.x + r.w).toBeLessThanOrEqual(layout.width)
      expect(r.y + r.h).toBeLessThanOrEqual(layout.height)
    }
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]
        const b = rects[j]
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
        expect(overlap).toBe(false)
      }
  })

  it('calcule les faces en UV boîte', () => {
    const f = boxFaces({ cubeId: 'c', u: 0, v: 0, w: 8, h: 8, d: 8 })
    expect(f.north).toEqual([8, 8, 16, 16])
    expect(f.up).toEqual([16, 8, 8, 0])
  })

  it('exporte un os par cube et se réimporte à l’identique', () => {
    const model = newModel()
    model.cubes[1].rotation = [0, 45, 0]
    const layout = layoutUv(model.cubes)
    const bb = buildBbmodel(model, layout, 'data:image/png;base64,')
    expect(bb.meta.model_format).toBe('modded_entity')
    expect(bb.elements).toHaveLength(model.cubes.length)
    expect(bb.outliner).toHaveLength(model.cubes.length)
    const back = importBbmodel(JSON.parse(JSON.stringify(bb)), 'x', id)
    expect(back.cubes.map((c) => [c.from, c.size, c.origin, c.rotation])).toEqual(
      model.cubes.map((c) => [c.from, c.size, c.origin, c.rotation]),
    )
  })
})

describe('FancyMenu', () => {
  it('exporte boutons, textes et formes', () => {
    const gui = newGui('menu', 'fancymenu')
    gui.elements = newGui('x', 'mod').elements
    gui.elements[2].action = { kind: 'command', command: 'spawn' }
    const out = exportFancyMenu(gui)
    expect(out.layoutPath).toBe('config/fancymenu/customization/menu.txt')
    expect(out.layout).toContain('type = fancymenu_layout')
    expect(out.layout).toContain('identifier = title_screen')
    expect(out.layout).toContain('element_type = custom_button')
    expect(out.layout).toContain('element_type = text_v2')
    expect(out.layout).toContain('element_type = shape')
    expect(out.layout).toMatch(/\[action_type:sendmessage\] = \/spawn/)
  })
})
