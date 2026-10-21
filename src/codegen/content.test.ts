import { describe, expect, it } from 'vitest'
import { inflateSync } from 'node:zlib'
import { emptyProject, newContent, newModel, newProject } from '../project/defaults'
import { migrate } from '../project/migrate'
import { base64ToBytes, encodePng } from '../lib/png'
import type { EntityContent } from '../project/types'
import { contentRegistryNames, generateEntityModel, modelBounds, resolveContentRef } from './content'
import { buildMod } from './modProject'

describe('PNG', () => {
  it('produit un PNG valide (signature, IHDR, données zlib)', () => {
    const rgba = new Uint8Array(2 * 2 * 4).fill(200)
    const png = encodePng(2, 2, rgba)
    expect([...png.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const idatAt = Buffer.from(png).indexOf('IDAT')
    const len = new DataView(png.buffer).getUint32(idatAt - 4)
    const raw = inflateSync(Buffer.from(png.slice(idatAt + 4, idatAt + 4 + len)))
    expect(raw.length).toBe(2 * (2 * 4 + 1))
    expect(raw[1]).toBe(200)
  })
})

describe('contenu personnalisé', () => {
  it('donne des noms de registre uniques', () => {
    const a = newContent('item', 'Épée')
    const b = newContent('block', 'épée')
    const c = newContent('entity', 'Epee')
    const names = contentRegistryNames([a, b, c])
    expect([names.get(a.id), names.get(b.id), names.get(c.id)]).toEqual(['epee', 'epee_2', 'epee_3'])
  })

  it('résout les références de contenu', () => {
    const p = emptyProject()
    const item = newContent('item', 'Baguette magique')
    p.content.push(item)
    expect(resolveContentRef(p, `content:${item.id}`)).toBe('monmod:baguette_magique')
    expect(resolveContentRef(p, 'content:inconnu')).toBeNull()
    expect(resolveContentRef(p, 'minecraft:stick')).toBe('minecraft:stick')
  })

  it('génère objets, blocs et créatures', () => {
    const p = emptyProject()
    const model = newModel('golem')
    p.models.push(model)
    p.content.push(newContent('item', 'Baguette'), newContent('block', 'Pierre bleue'), newContent('entity', 'Golem', model.id))
    const { files, diagnostics } = buildMod(p)
    expect(diagnostics.filter((d) => d.level === 'error')).toEqual([])
    const byPath = (end: string) => files.find((f) => f.path.endsWith(end))
    const content = byPath('/ModContent.java')!.content
    expect(content).toContain('ITEMS.registerSimpleItem("baguette", new Item.Properties().stacksTo(64))')
    expect(content).toContain('BLOCKS.registerSimpleBlock("pierre_bleue", BlockBehaviour.Properties.of().strength(1.5F))')
    expect(content).toContain('ITEMS.registerSimpleBlockItem(PIERRE_BLEUE)')
    expect(content).toContain('EntityType.Builder.of(GolemEntity::new, MobCategory.CREATURE)')
    expect(content).toContain('new DeferredSpawnEggItem(GOLEM, 0x3B82C4, 0xE0B48A, new Item.Properties())')
    expect(byPath('/MonMod.java')!.content).toContain('ModContent.register(modEventBus);')
    expect(byPath('/ModContentEvents.java')!.content).toContain('event.put(ModContent.GOLEM.get(), GolemEntity.createAttributes().build());')
    expect(byPath('/client/ModClientSetup.java')!.content).toContain('event.registerLayerDefinition(GolemModel.LAYER_LOCATION, GolemModel::createBodyLayer);')
    expect(byPath('/blockstates/pierre_bleue.json')).toBeDefined()
    expect(byPath('/loot_table/blocks/pierre_bleue.json')).toBeDefined()
    expect(byPath('/textures/entity/golem.png')!.dataUrl).toMatch(/^data:image\/png;base64,/)
    const lang = JSON.parse(byPath('/lang/en_us.json')!.content)
    expect(lang['item.monmod.baguette']).toBe('Baguette')
    expect(lang['entity.monmod.golem']).toBe('Golem')
  })

  it('signale une créature sans modèle', () => {
    const p = emptyProject()
    p.content.push(newContent('entity', 'Fantome', 'absent'))
    expect(buildMod(p).diagnostics.some((d) => d.level === 'error')).toBe(true)
  })

  it('convertit les cubes Blockbench en coordonnées Minecraft', () => {
    const model = newModel('m')
    model.cubes = [{ ...model.cubes[1], from: [-4, 24, -4], size: [8, 8, 8], origin: [0, 24, 0], rotation: [0, 0, 0] }]
    const { source } = generateEntityModel('com.x', 'XMod', 'MModel', 'm', model)
    expect(source).toContain('.addBox(-4.0F, -8.0F, -4.0F, 8.0F, 8.0F, 8.0F, new CubeDeformation(0.0F))')
    expect(source).toContain('PartPose.offsetAndRotation(0.0F, 0.0F, 0.0F, 0.0F, 0.0F, 0.0F)')
    expect(modelBounds(model)).toEqual({ width: 0.5, height: 2 })
  })
})

describe('modèle « Mod de bienvenue »', () => {
  it('compile sans erreur et utilise ses contenus', () => {
    const p = newProject()
    const { files, diagnostics } = buildMod(p)
    expect(diagnostics.filter((d) => d.level === 'error')).toEqual([])
    const events = files.find((f) => f.path.endsWith('/ModEvents.java'))!.content
    expect(events).toContain('ResourceLocation.parse("monmod:pierre_de_bienvenue")')
    expect(events).toContain('ResourceLocation.parse("monmod:compagnon")).spawn(level')
    expect(files.find((f) => f.path.endsWith('/ModKeys.java'))!.content).toContain('GLFW.GLFW_KEY_G')
    const comp = p.content.find((c) => c.kind === 'entity') as EntityContent
    expect(comp.modelId).toBe(p.models[0].id)
    const tex = files.find((f) => f.path.endsWith('textures/item/pierre_de_bienvenue.png'))!
    expect(base64ToBytes(tex.dataUrl!.split(',')[1]).length).toBeGreaterThan(100)
  })
})

describe('migrations', () => {
  it('met à niveau un projet v1', () => {
    const v1 = { ...emptyProject(), formatVersion: 1 } as Record<string, unknown>
    delete v1.content
    expect(migrate(v1).content).toEqual([])
    expect(migrate(v1).formatVersion).toBe(2)
  })
  it('refuse un fichier étranger ou trop récent', () => {
    expect(() => migrate({ hello: 1 })).toThrow(/pas un projet Tessera/)
    expect(() => migrate({ ...emptyProject(), formatVersion: 99 })).toThrow(/plus récente/)
  })
})
