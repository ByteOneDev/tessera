// Génération Java des nœuds de logique (sens unique : nœuds → Java).
import { NODE_DEF_BY_TYPE, type Side } from '../nodes/nodeDefs'
import type { LogicNode, Project } from '../project/types'
import { indent, javaString, mainClassName, packageName, resourceId, screenClassNames } from './names'

export interface Diagnostic {
  nodeId?: string
  level: 'error' | 'warning'
  message: string
}

export interface LogicOutput {
  modEvents: string
  clientEvents: string
  keys: string
  langEntries: Record<string, string>
  diagnostics: Diagnostic[]
}

type Ctx = 'server' | 'client' | 'both'

const SERVER_GUARD = 'if (!player.level().isClientSide()) {'
const CLIENT_GUARD = 'if (player.level().isClientSide()) {'
const HEADER = '// Généré par Tessera : ce fichier est réécrit à chaque export, ne le modifiez pas à la main.'

const EVENT_JAVA: Record<string, { cls: string; method: string; prelude: string[] }> = {
  'event.player_join': {
    cls: 'PlayerEvent.PlayerLoggedInEvent',
    method: 'onPlayerJoin',
    prelude: ['Player player = event.getEntity();'],
  },
  'event.player_respawn': {
    cls: 'PlayerEvent.PlayerRespawnEvent',
    method: 'onPlayerRespawn',
    prelude: ['Player player = event.getEntity();'],
  },
  'event.right_click_item': {
    cls: 'PlayerInteractEvent.RightClickItem',
    method: 'onRightClickItem',
    prelude: ['Player player = event.getEntity();'],
  },
  'event.block_break': {
    cls: 'BlockEvent.BreakEvent',
    method: 'onBlockBreak',
    prelude: ['Player player = event.getPlayer();'],
  },
  'event.entity_kill': {
    cls: 'LivingDeathEvent',
    method: 'onEntityKill',
    prelude: ['if (!(event.getSource().getEntity() instanceof Player player)) return;'],
  },
  'event.chat': {
    cls: 'ServerChatEvent',
    method: 'onChat',
    prelude: ['Player player = event.getPlayer();'],
  },
}

export function generateLogic(project: Project): LogicOutput {
  const { nodes, edges } = project.logic
  const meta = project.meta
  const pkg = packageName(meta)
  const main = mainClassName(meta)
  const screens = screenClassNames(project.guis)
  const diagnostics: Diagnostic[] = []
  const langEntries: Record<string, string> = {}
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const reached = new Set<string>()

  const err = (node: LogicNode, message: string) => diagnostics.push({ nodeId: node.id, level: 'error', message })
  const warn = (node: LogicNode, message: string) => diagnostics.push({ nodeId: node.id, level: 'warning', message })

  const rl = (node: LogicNode, key: string) => {
    const { id, valid } = resourceId(node.params[key] ?? '')
    if (!valid) err(node, `Identifiant invalide : « ${node.params[key] ?? ''} »`)
    return `ResourceLocation.parse(${javaString(id)})`
  }
  const num = (node: LogicNode, key: string, kind: 'int' | 'float' | 'double') => {
    const raw = (node.params[key] ?? '').trim().replace(',', '.')
    const v = Number(raw)
    if (raw === '' || !Number.isFinite(v)) {
      err(node, `Nombre invalide pour « ${key} » : « ${raw} »`)
      return kind === 'int' ? '0' : kind === 'float' ? '0.0F' : '0.0D'
    }
    if (kind === 'int') return String(Math.round(v))
    const s = Number.isInteger(v) ? v.toFixed(1) : String(v)
    return kind === 'float' ? `${s}F` : `${s}D`
  }
  const text = (node: LogicNode, key: string) => javaString(node.params[key] ?? '')

  function conditionExpr(node: LogicNode): string {
    switch (node.type) {
      case 'condition.sneaking':
        return 'player.isShiftKeyDown()'
      case 'condition.creative':
        return 'player.isCreative()'
      case 'condition.holding':
        return `player.getMainHandItem().is(BuiltInRegistries.ITEM.get(${rl(node, 'item')}))`
      case 'condition.chance':
        return `player.getRandom().nextFloat() * 100.0F < ${num(node, 'percent', 'float')}`
      case 'condition.name':
        return `player.getName().getString().equals(${text(node, 'name')})`
      default:
        err(node, `Condition inconnue : ${node.type}`)
        return 'false'
    }
  }

  function actionLines(node: LogicNode, variant: 'server' | 'client'): string[] {
    switch (node.type) {
      case 'action.message':
        return variant === 'server'
          ? [`player.sendSystemMessage(Component.literal(${text(node, 'text')}));`]
          : [`player.displayClientMessage(Component.literal(${text(node, 'text')}), false);`]
      case 'action.give_item':
        return [
          `player.getInventory().add(new ItemStack(BuiltInRegistries.ITEM.get(${rl(node, 'item')}), ${num(node, 'count', 'int')}));`,
        ]
      case 'action.teleport':
        return [`player.teleportTo(${num(node, 'x', 'double')}, ${num(node, 'y', 'double')}, ${num(node, 'z', 'double')});`]
      case 'action.sound': {
        const lookup = `SoundEvent sound = BuiltInRegistries.SOUND_EVENT.get(${rl(node, 'sound')});`
        return variant === 'server'
          ? [
              '{',
              '    ' + lookup,
              '    if (sound != null) player.level().playSound(null, player.getX(), player.getY(), player.getZ(), sound, SoundSource.PLAYERS, 1.0F, 1.0F);',
              '}',
            ]
          : ['{', '    ' + lookup, '    if (sound != null) player.playSound(sound, 1.0F, 1.0F);', '}']
      }
      case 'action.effect': {
        const ticks = `${num(node, 'seconds', 'int')} * 20`
        const amp = `${num(node, 'level', 'int')} - 1`
        return [
          `BuiltInRegistries.MOB_EFFECT.getHolder(${rl(node, 'effect')})`,
          `        .ifPresent(effect -> player.addEffect(new MobEffectInstance(effect, ${ticks}, ${amp})));`,
        ]
      }
      case 'action.heal':
        return [`player.heal(${num(node, 'amount', 'float')});`]
      case 'action.command': {
        const cmd = javaString((node.params.command ?? '').trim().replace(/^\//, ''))
        return variant === 'server'
          ? [
              'if (player.getServer() != null) {',
              `    player.getServer().getCommands().performPrefixedCommand(player.createCommandSourceStack().withPermission(4).withSuppressedOutput(), ${cmd});`,
              '}',
            ]
          : [`player.connection.sendCommand(${cmd});`]
      }
      case 'action.open_gui': {
        const cls = screens.get(node.params.gui ?? '')
        if (!cls) {
          err(node, 'Choisissez un écran de type « mod » à ouvrir.')
          return ['// Écran introuvable']
        }
        return [`ModClient.openScreen(${javaString(cls)});`]
      }
      case 'action.java':
        return (node.params.code ?? '').split('\n')
      default:
        err(node, `Action inconnue : ${node.type}`)
        return []
    }
  }

  /** Place une action en fonction du côté de l'événement et du côté où elle fonctionne. */
  function placeAction(node: LogicNode, actionSide: Side, ctx: Ctx): string[] {
    if (actionSide === 'both') {
      if (ctx === 'client') return actionLines(node, 'client')
      const lines = actionLines(node, 'server')
      return ctx === 'server' ? lines : [SERVER_GUARD, ...indent(lines), '}']
    }
    if (actionSide === ctx) return actionLines(node, actionSide)
    if (ctx === 'both') {
      return [actionSide === 'server' ? SERVER_GUARD : CLIENT_GUARD, ...indent(actionLines(node, actionSide)), '}']
    }
    const label = NODE_DEF_BY_TYPE[node.type]?.label ?? node.type
    err(
      node,
      actionSide === 'client'
        ? `« ${label} » fonctionne côté client : reliez-le à un événement client (Touche pressée, Clic droit).`
        : `« ${label} » fonctionne côté serveur : il ne peut pas suivre un événement client.`,
    )
    return [`// Ignoré : « ${label} » ne peut pas être exécuté ici.`]
  }

  function emitFrom(sourceId: string, handle: string, ctx: Ctx, path: Set<string>): string[] {
    const targets = edges
      .filter((e) => e.source === sourceId && e.sourceHandle === handle)
      .map((e) => byId.get(e.target))
      .filter((n): n is LogicNode => !!n)
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
    return targets.flatMap((t) => emitNode(t, ctx, path))
  }

  function emitNode(node: LogicNode, ctx: Ctx, path: Set<string>): string[] {
    const def = NODE_DEF_BY_TYPE[node.type]
    if (!def) {
      err(node, `Nœud inconnu : ${node.type}`)
      return []
    }
    if (path.has(node.id)) {
      err(node, 'Boucle détectée : ce nœud est relié à lui-même.')
      return ['// Boucle ignorée']
    }
    reached.add(node.id)
    const next = new Set(path).add(node.id)
    if (def.category === 'event') {
      err(node, 'Un événement ne peut pas être la suite d’un autre nœud.')
      return []
    }
    const comment = `// ${def.label}`
    if (def.category === 'condition') {
      const yes = emitFrom(node.id, 'true', ctx, next)
      const no = emitFrom(node.id, 'false', ctx, next)
      const lines = [comment, `if (${conditionExpr(node)}) {`, ...indent(yes)]
      if (no.length) lines.push('} else {', ...indent(no))
      lines.push('}')
      return lines
    }
    return [comment, ...placeAction(node, def.side, ctx), ...emitFrom(node.id, 'out', ctx, next)]
  }

  const events = nodes
    .filter((n) => NODE_DEF_BY_TYPE[n.type]?.category === 'event')
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)

  const commonMethods: string[][] = []
  const keyHandlers: string[][] = []
  const keyFields: string[] = []
  const keyRegs: string[] = []
  const keyLoops: string[] = []
  const methodCount: Record<string, number> = {}

  for (const ev of events) {
    const def = NODE_DEF_BY_TYPE[ev.type]
    reached.add(ev.id)
    if (!edges.some((e) => e.source === ev.id)) warn(ev, `« ${def.label} » n’est relié à aucune action.`)

    if (ev.type === 'event.key_press') {
      const i = keyFields.length
      const key = (ev.params.key ?? '').trim().toUpperCase()
      if (!/^([A-Z0-9]|F([1-9]|1[0-2]))$/.test(key)) err(ev, `Touche non prise en charge : « ${ev.params.key} » (A-Z, 0-9, F1-F12).`)
      const glfwKey = /^[A-Z0-9]$|^F([1-9]|1[0-2])$/.test(key) ? key : 'G'
      const langKey = `key.${meta.modId}.action_${i}`
      langEntries[langKey] = ev.params.name?.trim() || `Action ${i + 1}`
      keyFields.push(
        `public static final KeyMapping KEY_${i} = new KeyMapping(${javaString(langKey)}, GLFW.GLFW_KEY_${glfwKey}, CATEGORY);`,
      )
      keyRegs.push(`event.register(KEY_${i});`)
      keyLoops.push(`while (ModKeys.KEY_${i}.consumeClick()) {`, `    onKey${i}(player);`, '}')
      keyHandlers.push([
        `// ${def.label} : ${glfwKey}`,
        `private static void onKey${i}(LocalPlayer player) {`,
        ...indent(emitFrom(ev.id, 'out', 'client', new Set([ev.id]))),
        '}',
      ])
      continue
    }

    const java = EVENT_JAVA[ev.type]
    if (!java) {
      err(ev, `Événement inconnu : ${ev.type}`)
      continue
    }
    const n = (methodCount[java.method] = (methodCount[java.method] ?? 0) + 1)
    const prelude = [...java.prelude]
    if (ev.type === 'event.right_click_item' && ev.params.item?.trim()) {
      prelude.push(`if (!event.getItemStack().is(BuiltInRegistries.ITEM.get(${rl(ev, 'item')}))) return;`)
    }
    if (ev.type === 'event.block_break' && ev.params.block?.trim()) {
      prelude.push(`if (!event.getState().is(BuiltInRegistries.BLOCK.get(${rl(ev, 'block')}))) return;`)
    }
    if (ev.type === 'event.chat' && ev.params.contains) {
      prelude.push(`if (!event.getRawText().contains(${text(ev, 'contains')})) return;`)
    }
    commonMethods.push([
      `// ${def.label}`,
      '@SubscribeEvent',
      `public static void ${java.method}${n > 1 ? n : ''}(${java.cls} event) {`,
      ...indent([...prelude, ...emitFrom(ev.id, 'out', def.side as Ctx, new Set([ev.id]))]),
      '}',
    ])
  }

  for (const n of nodes) {
    if (!reached.has(n.id)) warn(n, 'Ce nœud n’est relié à aucun événement : il ne sera pas exécuté.')
  }

  const join = (blocks: string[][]) => blocks.map((b) => indent(b).join('\n')).join('\n\n')

  const modEvents = `package ${pkg};

${HEADER}

import ${pkg}.client.ModClient;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.event.ServerChatEvent;
import net.neoforged.neoforge.event.entity.living.LivingDeathEvent;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;
import net.neoforged.neoforge.event.entity.player.PlayerInteractEvent;
import net.neoforged.neoforge.event.level.BlockEvent;

@EventBusSubscriber(modid = ${main}.MODID)
public class ModEvents {
${join(commonMethods)}
}
`

  const clientEvents = `package ${pkg}.client;

${HEADER}

import ${pkg}.${main};
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.sounds.SoundEvent;
import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.client.event.ClientTickEvent;

@EventBusSubscriber(modid = ${main}.MODID, value = Dist.CLIENT)
public class ModClientEvents {
    @SubscribeEvent
    public static void onClientTick(ClientTickEvent.Post event) {
        LocalPlayer player = Minecraft.getInstance().player;
        if (player == null) return;
${indent(keyLoops, 2).join('\n')}
    }
${keyHandlers.length ? '\n' + join(keyHandlers) + '\n' : ''}}
`

  langEntries[`key.categories.${meta.modId}`] = meta.name

  const keys = `package ${pkg}.client;

${HEADER}

import ${pkg}.${main};
import net.minecraft.client.KeyMapping;
import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.client.event.RegisterKeyMappingsEvent;
import org.lwjgl.glfw.GLFW;

@EventBusSubscriber(modid = ${main}.MODID, bus = EventBusSubscriber.Bus.MOD, value = Dist.CLIENT)
public class ModKeys {
    public static final String CATEGORY = ${javaString(`key.categories.${meta.modId}`)};
${indent(keyFields).join('\n')}

    @SubscribeEvent
    public static void register(RegisterKeyMappingsEvent event) {
${indent(keyRegs, 2).join('\n')}
    }
}
`

  return { modEvents, clientEvents, keys, langEntries, diagnostics }
}
