// Seul module autorisé à importer @tauri-apps/* (AD-6).
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open, save } from '@tauri-apps/plugin-dialog'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { buildZip } from '../lib/files'
import { bytesToBase64 } from '../lib/png'
import type { BuildResult, ExportEntry, Platform } from './index'
import { fromDisk, toDisk, type DiskAsset } from './diskFormat'
import type { ModFile } from '../codegen/modProject'

const dirname = (p: string) => p.replace(/[\\/][^\\/]*$/, '')
const basename = (p: string) => p.replace(/^.*[\\/]/, '')

const toOutFiles = (entries: ExportEntry[] | ModFile[]) =>
  entries.map((e) =>
    e.dataUrl
      ? { path: e.path, base64: e.dataUrl.split(',')[1] ?? '', executable: !!e.executable }
      : { path: e.path, content: e.content, executable: !!e.executable },
  )

async function writeBinary(target: string, bytes: Uint8Array) {
  await invoke('write_files_to', { dir: dirname(target), files: [{ path: basename(target), base64: bytesToBase64(bytes) }] })
}

export const tauriPlatform: Platform = {
  desktop: true,
  async saveProject(project, location) {
    let dir = location
    if (!dir) {
      const base = await invoke<string>('default_projects_dir')
      const picked = await save({ title: 'Dossier du projet Tessera', defaultPath: `${base}/${project.meta.modId}` })
      if (!picked) return null
      dir = picked
    }
    const { json, assets } = toDisk(project)
    await invoke('write_project', { dir, json, assets: assets.map((a) => ({ path: a.path, base64: a.base64 })) })
    return dir
  },
  async openProject() {
    const dir = await open({ title: 'Ouvrir un dossier de projet Tessera', directory: true })
    if (!dir || Array.isArray(dir)) return null
    return { project: await this.openProjectAt(dir), location: dir }
  },
  async openProjectAt(dir) {
    const files = await invoke<{ json: string; assets: DiskAsset[] }>('read_project', { dir })
    return fromDisk(files.json, files.assets)
  },
  async exportZip(entries, name) {
    const target = await save({ title: 'Exporter', defaultPath: name, filters: [{ name: 'Archive zip', extensions: ['zip'] }] })
    if (!target) return false
    await writeBinary(target, await buildZip(entries))
    return true
  },
  async exportText(text, name) {
    const ext = name.split('.').pop() ?? 'txt'
    const target = await save({ title: 'Exporter', defaultPath: name, filters: [{ name: ext, extensions: [ext] }] })
    if (!target) return false
    await invoke('write_files_to', { dir: dirname(target), files: [{ path: basename(target), content: text }] })
    return true
  },
  async build(modId, files, onLog) {
    const unlisten = await listen<string>('build://log', (e) => onLog(e.payload))
    try {
      return await invoke<BuildResult>('build_mod', { modId, files: toOutFiles(files) })
    } catch (e) {
      return { ok: false, error: String(e) }
    } finally {
      unlisten()
    }
  },
  async reveal(path) {
    await revealItemInDir(path)
  },
}
