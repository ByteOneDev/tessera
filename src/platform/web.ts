import { downloadText, downloadZip, pickFile } from '../lib/files'
import { migrate } from '../project/migrate'
import type { Platform } from './index'

export const webPlatform: Platform = {
  desktop: false,
  async saveProject(project) {
    const name = `${project.meta.modId}.tessera.json`
    downloadText(JSON.stringify(project, null, 2), name, 'application/json')
    return name
  },
  async openProject() {
    const file = await pickFile('.json,application/json')
    if (!file) return null
    return { project: migrate(JSON.parse(await file.text())), location: file.name }
  },
  async openProjectAt() {
    throw new Error('Les projets récents ne sont disponibles que dans l’application de bureau.')
  },
  async exportZip(entries, name) {
    await downloadZip(entries, name)
    return true
  },
  async exportText(text, name, mime) {
    downloadText(text, name, mime)
    return true
  },
  async build() {
    return { ok: false, error: 'Le Build en un clic nécessite l’application de bureau Tessera. Utilisez « Exporter » puis ./gradlew build.' }
  },
  async reveal() {},
}
