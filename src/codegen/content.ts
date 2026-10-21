// Génération du Contenu personnalisé : objets, blocs et créatures (FR-7, FR-12, FR-13).
import { Bitmap } from '../lib/png'
import { layoutUv, paintTexture } from '../modeler/bbmodel'
import type { Content, EntityContent, Model, Project } from '../project/types'
import type { Diagnostic } from './logic'
import { indent, javaString, mainClassName, packageName, pascal, slug } from './names'

export interface ContentFile {
  path: string
  content: string
  dataUrl?: string
}

/** Noms de registre uniques (AD-4). Objets, blocs et œufs partagent le registre des objets : unicité globale. */
export function contentRegistryNames(content: Content[]): Map<string, string> {
  const used = new Set<string>()
  const out = new Map<string, string>()
  for (const c of content) {
    const base = slug(c.name, c.kind)
    let name = base
    for (let i = 2; used.has(name) || used.has(`${name}_spawn_egg`); i++) name = `${base}_${i}`
    used.add(name)
    if (c.kind === 'entity') used.add(`${name}_spawn_egg`)
    out.set(c.id, name)
  }
  return out
}

export const CONTENT_REF = 'content:'

/** Résout `content:<id>` en `<modid>:<nom>` ; renvoie null si le contenu n'existe plus. */
export function resolveContentRef(project: Project, raw: string): string | null {
  if (!raw.startsWith(CONTENT_REF)) return raw
  const id = raw.slice(CONTENT_REF.length)
  const name = contentRegistryNames(project.content).get(id)
  return name ? `${project.meta.modId}:${name}` : null
}

const field = (registryName: string) => registryName.toUpperCase()
const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n)) + 'F'
const d = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n)) + 'D'
const rgb = (hex: string) => '0x' + (/^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? 'FFFFFF').toUpperCase()

function placeholderTexture(color: string): string {
  const bmp = new Bitmap(16, 16)
  bmp.fillRect(0, 0, 16, 16, color)
  bmp.fillRect(0, 0, 8, 8, '#000000', 60)
  bmp.fillRect(8, 8, 8, 8, '#000000', 60)
  return bmp.toDataUrl()
}

/** Dimensions de la boîte de collision (en blocs) à partir des cubes du modèle. */
export function modelBounds(model: Model | undefined): { width: number; height: number } {
  if (!model || !model.cubes.length) return { width: 0.6, height: 1.8 }
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = 0
  for (const c of model.cubes) {
    minX = Math.min(minX, c.from[0])
    maxX = Math.max(maxX, c.from[0] + c.size[0])
    minZ = Math.min(minZ, c.from[2])
    maxZ = Math.max(maxZ, c.from[2] + c.size[2])
    maxY = Math.max(maxY, c.from[1] + c.size[1])
  }
  const round = (n: number) => Math.max(0.1, Math.round((n / 16) * 100) / 100)
  return { width: round(Math.max(maxX - minX, maxZ - minZ)), height: round(maxY) }
}

/** Classe Java du modèle d'entité (conversion Blockbench → Minecraft : x et y inversés, y=24 aux pieds). */
export function generateEntityModel(pkg: string, main: string, cls: string, registryName: string, model: Model) {
  const layout = layoutUv(model.cubes)
  const slotOf = new Map(layout.slots.map((s) => [s.cubeId, s]))
  const rad = (deg: number) => f(Math.round(((deg * Math.PI) / 180) * 10000) / 10000)
  const usedParts = new Set<string>()
  const parts = model.cubes.map((c, i) => {
    let part = slug(c.name, `part_${i}`)
    while (usedParts.has(part)) part += '_'
    usedParts.add(part)
    const s = slotOf.get(c.id)!
    const [ox, oy, oz] = c.origin
    const box = [ox - (c.from[0] + c.size[0]), oy - (c.from[1] + c.size[1]), c.from[2] - oz]
    const [rx, ry, rz] = c.rotation
    return (
      `root.addOrReplaceChild(${javaString(part)}, CubeListBuilder.create().texOffs(${s.u}, ${s.v})` +
      `.addBox(${box.map(f).join(', ')}, ${c.size.map(f).join(', ')}, new CubeDeformation(0.0F)),\n` +
      `        PartPose.offsetAndRotation(${f(-ox)}, ${f(24 - oy)}, ${f(oz)}, ${rad(-rx)}, ${rad(-ry)}, ${rad(rz)}));`
    )
  })
  return {
    texture: paintTexture(model, layout),
    source: `package ${pkg}.client.model;

// Généré par Tessera à partir du modèle « ${model.name} ».

import ${pkg}.${main};
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import net.minecraft.client.model.EntityModel;
import net.minecraft.client.model.geom.ModelLayerLocation;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.model.geom.PartPose;
import net.minecraft.client.model.geom.builders.CubeDeformation;
import net.minecraft.client.model.geom.builders.CubeListBuilder;
import net.minecraft.client.model.geom.builders.LayerDefinition;
import net.minecraft.client.model.geom.builders.MeshDefinition;
import net.minecraft.client.model.geom.builders.PartDefinition;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.Entity;

public class ${cls}<T extends Entity> extends EntityModel<T> {
    public static final ModelLayerLocation LAYER_LOCATION =
            new ModelLayerLocation(ResourceLocation.fromNamespaceAndPath(${main}.MODID, ${javaString(registryName)}), "main");
    private final ModelPart root;

    public ${cls}(ModelPart root) {
        this.root = root;
    }

    public static LayerDefinition createBodyLayer() {
        MeshDefinition mesh = new MeshDefinition();
        PartDefinition root = mesh.getRoot();
${indent(parts, 2).join('\n')}
        return LayerDefinition.create(mesh, ${layout.width}, ${layout.height});
    }

    @Override
    public void setupAnim(T entity, float limbSwing, float limbSwingAmount, float ageInTicks, float netHeadYaw, float headPitch) {
    }

    @Override
    public void renderToBuffer(PoseStack poseStack, VertexConsumer buffer, int packedLight, int packedOverlay, int color) {
        root.render(poseStack, buffer, packedLight, packedOverlay, color);
    }
}
`,
  }
}

export interface ContentOutput {
  files: ContentFile[]
  lang: Record<string, string>
  diagnostics: Diagnostic[]
  /** true si ModContent.register(bus) doit être appelé par la classe principale. */
  hasContent: boolean
}

export function generateContent(project: Project): ContentOutput {
  const { meta } = project
  const pkg = packageName(meta)
  const main = mainClassName(meta)
  const modId = meta.modId
  const java = `src/main/java/${pkg.replace(/\./g, '/')}`
  const assets = `src/main/resources/assets/${modId}`
  const data = `src/main/resources/data/${modId}`
  const names = contentRegistryNames(project.content)
  const files: ContentFile[] = []
  const lang: Record<string, string> = {}
  const diagnostics: Diagnostic[] = []
  const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n'

  const fields: string[] = []
  const tabItems: string[] = []
  const attributes: string[] = []
  const renderers: string[] = []
  const layers: string[] = []
  const entityBases: string[] = []

  for (const c of project.content) {
    const name = names.get(c.id)!
    const F = field(name)
    if (c.kind === 'item') {
      fields.push(
        `public static final DeferredItem<Item> ${F} = ITEMS.registerSimpleItem(${javaString(name)}, new Item.Properties().stacksTo(${Math.min(99, Math.max(1, Math.round(c.maxStack)))}));`,
      )
      tabItems.push(`output.accept(${F}.get());`)
      lang[`item.${modId}.${name}`] = c.name
      files.push({ path: `${assets}/models/item/${name}.json`, content: json({ parent: 'minecraft:item/generated', textures: { layer0: `${modId}:item/${name}` } }) })
      files.push({ path: `${assets}/textures/item/${name}.png`, content: '', dataUrl: c.texture ?? placeholderTexture('#b05bc4') })
    } else if (c.kind === 'block') {
      fields.push(
        `public static final DeferredBlock<Block> ${F} = BLOCKS.registerSimpleBlock(${javaString(name)}, BlockBehaviour.Properties.of().strength(${f(Math.max(0, c.hardness))}));`,
        `public static final DeferredItem<BlockItem> ${F}_ITEM = ITEMS.registerSimpleBlockItem(${F});`,
      )
      tabItems.push(`output.accept(${F}_ITEM.get());`)
      lang[`block.${modId}.${name}`] = c.name
      files.push({ path: `${assets}/blockstates/${name}.json`, content: json({ variants: { '': { model: `${modId}:block/${name}` } } }) })
      files.push({ path: `${assets}/models/block/${name}.json`, content: json({ parent: 'minecraft:block/cube_all', textures: { all: `${modId}:block/${name}` } }) })
      files.push({ path: `${assets}/models/item/${name}.json`, content: json({ parent: `${modId}:block/${name}` }) })
      files.push({ path: `${assets}/textures/block/${name}.png`, content: '', dataUrl: c.texture ?? placeholderTexture('#7a8796') })
      files.push({
        path: `${data}/loot_table/blocks/${name}.json`,
        content: json({
          type: 'minecraft:block',
          pools: [{ rolls: 1, entries: [{ type: 'minecraft:item', name: `${modId}:${name}` }], conditions: [{ condition: 'minecraft:survives_explosion' }] }],
        }),
      })
    } else {
      const ent = c as EntityContent
      const model = project.models.find((m) => m.id === ent.modelId)
      if (!model || !model.cubes.length) {
        diagnostics.push({ level: 'error', message: `La créature « ${c.name} » n’a pas de modèle (ou son modèle est vide).` })
        continue
      }
      const base = pascal(name, 'Creature')
      entityBases.push(base)
      const entityCls = `${base}Entity`
      const modelCls = `${base}Model`
      const rendererCls = `${base}Renderer`
      const { width, height } = modelBounds(model)
      fields.push(
        `public static final DeferredHolder<EntityType<?>, EntityType<${entityCls}>> ${F} = ENTITY_TYPES.register(${javaString(name)},`,
        `        () -> EntityType.Builder.of(${entityCls}::new, MobCategory.CREATURE).sized(${f(width)}, ${f(height)}).build(${javaString(name)}));`,
        `public static final DeferredItem<SpawnEggItem> ${F}_SPAWN_EGG = ITEMS.register(${javaString(name + '_spawn_egg')},`,
        `        () -> new DeferredSpawnEggItem(${F}, ${rgb(ent.eggPrimary)}, ${rgb(ent.eggSecondary)}, new Item.Properties()));`,
      )
      tabItems.push(`output.accept(${F}_SPAWN_EGG.get());`)
      attributes.push(`event.put(ModContent.${F}.get(), ${entityCls}.createAttributes().build());`)
      renderers.push(`event.registerEntityRenderer(ModContent.${F}.get(), ${rendererCls}::new);`)
      layers.push(`event.registerLayerDefinition(${modelCls}.LAYER_LOCATION, ${modelCls}::createBodyLayer);`)
      lang[`entity.${modId}.${name}`] = c.name
      lang[`item.${modId}.${name}_spawn_egg`] = `Œuf d’apparition : ${c.name}`
      files.push({ path: `${assets}/models/item/${name}_spawn_egg.json`, content: json({ parent: 'minecraft:item/template_spawn_egg' }) })

      const gen = generateEntityModel(pkg, main, modelCls, name, model)
      files.push({ path: `${java}/client/model/${modelCls}.java`, content: gen.source })
      files.push({ path: `${assets}/textures/entity/${name}.png`, content: '', dataUrl: ent.texture ?? gen.texture })
      files.push({
        path: `${java}/entity/${entityCls}.java`,
        content: `package ${pkg}.entity;

// Généré par Tessera : créature « ${c.name} » (comportement passif : erre, fuit quand on la frappe, regarde les joueurs).

import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.PathfinderMob;
import net.minecraft.world.entity.ai.attributes.AttributeSupplier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.ai.goal.FloatGoal;
import net.minecraft.world.entity.ai.goal.LookAtPlayerGoal;
import net.minecraft.world.entity.ai.goal.PanicGoal;
import net.minecraft.world.entity.ai.goal.RandomLookAroundGoal;
import net.minecraft.world.entity.ai.goal.WaterAvoidingRandomStrollGoal;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.Level;

public class ${entityCls} extends PathfinderMob {
    public ${entityCls}(EntityType<? extends PathfinderMob> type, Level level) {
        super(type, level);
    }

    @Override
    protected void registerGoals() {
        this.goalSelector.addGoal(0, new FloatGoal(this));
        this.goalSelector.addGoal(1, new PanicGoal(this, 1.25D));
        this.goalSelector.addGoal(5, new WaterAvoidingRandomStrollGoal(this, 1.0D));
        this.goalSelector.addGoal(6, new LookAtPlayerGoal(this, Player.class, 6.0F));
        this.goalSelector.addGoal(7, new RandomLookAroundGoal(this));
    }

    public static AttributeSupplier.Builder createAttributes() {
        return Mob.createMobAttributes()
                .add(Attributes.MAX_HEALTH, ${d(Math.max(1, ent.health))})
                .add(Attributes.MOVEMENT_SPEED, ${d(Math.max(0, ent.speed))});
    }
}
`,
      })
      files.push({
        path: `${java}/client/renderer/${rendererCls}.java`,
        content: `package ${pkg}.client.renderer;

// Généré par Tessera.

import ${pkg}.${main};
import ${pkg}.client.model.${modelCls};
import ${pkg}.entity.${entityCls};
import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.client.renderer.entity.MobRenderer;
import net.minecraft.resources.ResourceLocation;

public class ${rendererCls} extends MobRenderer<${entityCls}, ${modelCls}<${entityCls}>> {
    private static final ResourceLocation TEXTURE =
            ResourceLocation.fromNamespaceAndPath(${main}.MODID, ${javaString(`textures/entity/${name}.png`)});

    public ${rendererCls}(EntityRendererProvider.Context context) {
        super(context, new ${modelCls}<>(context.bakeLayer(${modelCls}.LAYER_LOCATION)), ${f(Math.round(Math.min(1, width / 2) * 10) / 10)});
    }

    @Override
    public ResourceLocation getTextureLocation(${entityCls} entity) {
        return TEXTURE;
    }
}
`,
      })
    }
  }

  const hasContent = fields.length > 0
  if (!hasContent) return { files, lang, diagnostics, hasContent }

  lang[`itemGroup.${modId}`] = meta.name
  const entityImports = entityBases.map((b) => `import ${pkg}.entity.${b}Entity;`)
  const firstTab = tabItems[0].replace('output.accept(', '').replace('.get());', '')

  files.push({
    path: `${java}/ModContent.java`,
    content: `package ${pkg};

// Généré par Tessera : enregistrement des objets, blocs et créatures du mod.

${entityImports.join('\n')}
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.MobCategory;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.CreativeModeTab;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.SpawnEggItem;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.neoforge.common.DeferredSpawnEggItem;
import net.neoforged.neoforge.registries.DeferredBlock;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredItem;
import net.neoforged.neoforge.registries.DeferredRegister;

public final class ModContent {
    public static final DeferredRegister.Items ITEMS = DeferredRegister.createItems(${main}.MODID);
    public static final DeferredRegister.Blocks BLOCKS = DeferredRegister.createBlocks(${main}.MODID);
    public static final DeferredRegister<EntityType<?>> ENTITY_TYPES = DeferredRegister.create(Registries.ENTITY_TYPE, ${main}.MODID);
    public static final DeferredRegister<CreativeModeTab> TABS = DeferredRegister.create(Registries.CREATIVE_MODE_TAB, ${main}.MODID);

${indent(fields).join('\n')}

    public static final DeferredHolder<CreativeModeTab, CreativeModeTab> TAB = TABS.register("main", () -> CreativeModeTab.builder()
            .title(Component.translatable(${javaString(`itemGroup.${modId}`)}))
            .icon(() -> new ItemStack(${firstTab}.get()))
            .displayItems((parameters, output) -> {
${indent(tabItems, 4).join('\n')}
            })
            .build());

    private ModContent() {}

    public static void register(IEventBus modEventBus) {
        ITEMS.register(modEventBus);
        BLOCKS.register(modEventBus);
        ENTITY_TYPES.register(modEventBus);
        TABS.register(modEventBus);
    }
}
`,
  })

  if (attributes.length) {
    files.push({
      path: `${java}/ModContentEvents.java`,
      content: `package ${pkg};

// Généré par Tessera : attributs des créatures.

${entityImports.join('\n')}
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.event.entity.EntityAttributeCreationEvent;

@EventBusSubscriber(modid = ${main}.MODID, bus = EventBusSubscriber.Bus.MOD)
public class ModContentEvents {
    @SubscribeEvent
    public static void registerAttributes(EntityAttributeCreationEvent event) {
${indent(attributes, 2).join('\n')}
    }
}
`,
    })
    const clientImports = entityBases.flatMap((b) => [`import ${pkg}.client.model.${b}Model;`, `import ${pkg}.client.renderer.${b}Renderer;`])
    files.push({
      path: `${java}/client/ModClientSetup.java`,
      content: `package ${pkg}.client;

// Généré par Tessera : rendu des créatures.

import ${pkg}.${main};
import ${pkg}.ModContent;
${clientImports.join('\n')}
import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.client.event.EntityRenderersEvent;

@EventBusSubscriber(modid = ${main}.MODID, bus = EventBusSubscriber.Bus.MOD, value = Dist.CLIENT)
public class ModClientSetup {
    @SubscribeEvent
    public static void registerRenderers(EntityRenderersEvent.RegisterRenderers event) {
${indent(renderers, 2).join('\n')}
    }

    @SubscribeEvent
    public static void registerLayers(EntityRenderersEvent.RegisterLayerDefinitions event) {
${indent(layers, 2).join('\n')}
    }
}
`,
    })
  }

  return { files, lang, diagnostics, hasContent }
}
