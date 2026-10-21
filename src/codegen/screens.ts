// Génération des écrans de mod (classes Screen NeoForge 1.21.1) à partir du designer d'interfaces.
import type { ButtonAction, Gui, Project } from '../project/types'
import { indent, javaString, mainClassName, packageName, screenClassNames, slug } from './names'

export interface BinaryAsset {
  path: string
  dataUrl: string
}

export function argb(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  return '0xFF' + (m ? m[1].toUpperCase() : 'FFFFFF')
}

export function imagePath(gui: Gui, elementName: string, elementId: string): string {
  return `textures/gui/${slug(gui.name)}/${slug(elementName, elementId.toLowerCase())}.png`
}

function buttonHandler(action: ButtonAction, screens: Map<string, string>): string {
  switch (action.kind) {
    case 'close':
      return 'this.onClose()'
    case 'command':
      return `{ if (this.minecraft != null && this.minecraft.player != null) this.minecraft.player.connection.sendCommand(${javaString(action.command.trim().replace(/^\//, ''))}); }`
    case 'message':
      return `{ if (this.minecraft != null && this.minecraft.player != null) this.minecraft.player.displayClientMessage(Component.literal(${javaString(action.text)}), false); }`
    case 'open_gui': {
      const cls = screens.get(action.guiId)
      return cls ? `ModClient.openScreen(${javaString(cls)})` : '{}'
    }
    case 'open_link':
      return `Util.getPlatform().openUri(${javaString(action.url)})`
    case 'quit_game':
      return '{ if (this.minecraft != null) this.minecraft.stop(); }'
    default:
      return '{}'
  }
}

export function generateScreen(project: Project, gui: Gui, className: string, screens: Map<string, string>) {
  const pkg = packageName(project.meta)
  const main = mainClassName(project.meta)
  const assets: BinaryAsset[] = []
  const fields: string[] = []
  const widgets: string[] = []
  const background: string[] = []
  const foreground: string[] = []

  gui.elements.forEach((el, i) => {
    const x = `left + ${Math.round(el.x)}`
    const y = `top + ${Math.round(el.y)}`
    const w = Math.round(el.w)
    const h = Math.round(el.h)
    switch (el.type) {
      case 'panel':
        background.push(`graphics.fill(${x}, ${y}, ${x} + ${w}, ${y} + ${h}, ${argb(el.color)});`)
        break
      case 'image': {
        if (!el.image) break
        const path = imagePath(gui, el.name, el.id)
        const field = `IMAGE_${i}`
        fields.push(
          `private static final ResourceLocation ${field} = ResourceLocation.fromNamespaceAndPath(${main}.MODID, ${javaString(path)});`,
        )
        assets.push({ path: `assets/${project.meta.modId}/${path}`, dataUrl: el.image })
        background.push(`graphics.blit(${field}, ${x}, ${y}, 0, 0, ${w}, ${h}, ${w}, ${h});`)
        break
      }
      case 'label':
        foreground.push(
          `graphics.drawString(this.font, ${javaString(el.text)}, ${x}, ${y}, ${argb(el.color)}, ${el.textShadow});`,
        )
        break
      case 'button':
        widgets.push(
          `this.addRenderableWidget(Button.builder(Component.literal(${javaString(el.text)}), button -> ${buttonHandler(el.action, screens)})`,
          `        .bounds(${x}, ${y}, ${w}, ${h}).build());`,
        )
        break
    }
  })

  const source = `package ${pkg}.client.screens;

// Généré par Tessera à partir de l'interface « ${gui.name} ». Ce fichier est réécrit à chaque export.

import ${pkg}.${main};
import ${pkg}.client.ModClient;
import net.minecraft.Util;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;

public class ${className} extends Screen {
    private static final int GUI_WIDTH = ${Math.round(gui.width)};
    private static final int GUI_HEIGHT = ${Math.round(gui.height)};
${indent(fields).join('\n')}
    private int left;
    private int top;

    public ${className}() {
        super(Component.literal(${javaString(gui.name)}));
    }

    @Override
    protected void init() {
        this.left = (this.width - GUI_WIDTH) / 2;
        this.top = (this.height - GUI_HEIGHT) / 2;
${indent(widgets, 2).join('\n')}
    }

    @Override
    public void renderBackground(GuiGraphics graphics, int mouseX, int mouseY, float partialTick) {
        super.renderBackground(graphics, mouseX, mouseY, partialTick);
${indent(background, 2).join('\n')}
    }

    @Override
    public void render(GuiGraphics graphics, int mouseX, int mouseY, float partialTick) {
        super.render(graphics, mouseX, mouseY, partialTick);
${indent(foreground, 2).join('\n')}
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }
}
`
  return { source, assets }
}

export function generateModClient(project: Project): string {
  const pkg = packageName(project.meta)
  const screens = screenClassNames(project.guis)
  const imports = [...screens.values()].map((c) => `import ${pkg}.client.screens.${c};`)
  const cases = [...screens.values()].map((c) => `case ${javaString(c)} -> minecraft.setScreen(new ${c}());`)
  return `package ${pkg}.client;

// Généré par Tessera. Point d'entrée client : le code commun appelle openScreen() avec un nom,
// pour ne jamais charger de classe client sur un serveur dédié.

import net.minecraft.client.Minecraft;
${imports.join('\n')}

public final class ModClient {
    private ModClient() {}

    public static void openScreen(String name) {
        Minecraft minecraft = Minecraft.getInstance();
        switch (name) {
${indent(cases, 3).join('\n')}
            default -> {}
        }
    }
}
`
}
