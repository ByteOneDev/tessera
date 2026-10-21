// Adaptateur plateforme (AD-6) : les composants n'utilisent que ce module.
import type { ModFile } from '../codegen/modProject'
import type { Project } from '../project/types'
import { tauriPlatform } from './tauri'
import { webPlatform } from './web'

export interface ExportEntry {
  path: string
  content: string
  dataUrl?: string
  executable?: boolean
}

export interface BuildResult {
  ok: boolean
  jarPath?: string | null
  error?: string | null
}

export interface Platform {
  /** true dans l'application de bureau (Tauri). */
  desktop: boolean
  /** Enregistre le projet ; `location` null = demander où. Renvoie l'emplacement, ou null si annulé. */
  saveProject(project: Project, location: string | null): Promise<string | null>
  openProject(): Promise<{ project: Project; location: string } | null>
  openProjectAt(location: string): Promise<Project>
  exportZip(entries: ExportEntry[], suggestedName: string): Promise<boolean>
  exportText(text: string, suggestedName: string, mime: string): Promise<boolean>
  build(modId: string, files: ModFile[], onLog: (line: string) => void): Promise<BuildResult>
  reveal(path: string): Promise<void>
}

export const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export const platform: Platform = isTauri() ? tauriPlatform : webPlatform
