// Export d'une interface vers une mise en page FancyMenu 3.x (fichier .txt + images).
// Format reconstitué d'après des mises en page FancyMenu 3 : à valider sur une vraie installation.
import type { ButtonAction, Gui } from '../project/types'
import { slug } from './names'

export interface FancyMenuExport {
  layoutPath: string
  layout: string
  assets: { path: string; dataUrl: string }[]
}

const uuid = () => crypto.randomUUID()

function baseElement(type: string, x: number, y: number, w: number, h: number): string[] {
  const requirements = uuid()
  return [
    `element_type = ${type}`,
    `instance_identifier = ${uuid()}`,
    'appearance_delay = no_delay',
    'appearance_delay_seconds = 1.0',
    'fade_in = false',
    'fade_in_speed = 1.0',
    'anchor_point = top-left',
    `x = ${Math.round(x)}`,
    `y = ${Math.round(y)}`,
    `width = ${Math.round(w)}`,
    `height = ${Math.round(h)}`,
    'stretch_x = false',
    'stretch_y = false',
    'stay_on_screen = true',
    `element_loading_requirement_container_identifier = ${requirements}`,
    `[loading_requirement_container_meta:${requirements}] = [groups:][instances:]`,
  ]
}

function actionLines(action: ButtonAction, blockId: string): string[] {
  const entry = (type: string, value: string) => {
    const id = uuid()
    return [`[executable_action_instance:${id}][action_type:${type}] = ${value}`, `[executable_block:${blockId}][type:generic] = [executables:${id};]`]
  }
  switch (action.kind) {
    case 'command':
      return entry('sendmessage', '/' + action.command.trim().replace(/^\//, ''))
    case 'message':
      return entry('sendmessage', action.text)
    case 'open_link':
      return entry('openlink', action.url)
    case 'quit_game':
      return entry('quitgame', '')
    case 'close':
      return entry('closegui', '')
    default:
      return [`[executable_block:${blockId}][type:generic] = [executables:]`]
  }
}

export function exportFancyMenu(gui: Gui): FancyMenuExport {
  const name = slug(gui.name, 'tessera_layout')
  const assets: FancyMenuExport['assets'] = []
  const blocks: string[][] = []

  for (const el of gui.elements) {
    if (el.type === 'button') {
      const blockId = uuid()
      blocks.push([
        `button_element_executable_block_identifier = ${blockId}`,
        ...actionLines(el.action, blockId),
        `label = ${el.text}`,
        'navigatable = true',
        ...baseElement('custom_button', el.x, el.y, el.w, el.h),
      ])
    } else if (el.type === 'label') {
      blocks.push([
        `source = ${el.text}`,
        'source_mode = direct',
        `shadow = ${el.textShadow}`,
        'scale = 1.0',
        `base_color = ${el.color}`,
        'text_border = 0',
        'line_spacing = 1',
        ...baseElement('text_v2', el.x, el.y, el.w, el.h),
      ])
    } else if (el.type === 'panel') {
      blocks.push(['shape = rectangle', `color = ${el.color}`, ...baseElement('shape', el.x, el.y, el.w, el.h)])
    } else if (el.type === 'image' && el.image) {
      const file = `${name}_${slug(el.name, el.id.toLowerCase())}.png`
      assets.push({ path: `config/fancymenu/assets/${file}`, dataUrl: el.image })
      blocks.push([`source = [source:local]/config/fancymenu/assets/${file}`, ...baseElement('image', el.x, el.y, el.w, el.h)])
    }
  }

  const layout = [
    'type = fancymenu_layout',
    '',
    'layout-meta {',
    `  identifier = ${gui.fancyMenuScreen || 'title_screen'}`,
    '  render_custom_elements_behind_vanilla = false',
    `  last_edited_time = ${Date.now()}`,
    '  is_enabled = true',
    '  randommode = false',
    '  randomgroup = 1',
    '  randomonlyfirsttime = false',
    '  layout_index = 0',
    '}',
    '',
    ...blocks.flatMap((b) => ['element {', ...b.map((l) => '  ' + l), '}', '']),
  ].join('\n')

  return { layoutPath: `config/fancymenu/customization/${name}.txt`, layout, assets }
}
