// Wrapper Gradle officiel (servi depuis public/gradle-wrapper) ajouté aux fichiers du mod (FR-16, FR-17).
import type { ModFile } from '../codegen/modProject'
import { bytesToBase64 } from '../lib/png'

const FILES = ['gradlew', 'gradlew.bat', 'gradle/wrapper/gradle-wrapper.properties', 'gradle/wrapper/gradle-wrapper.jar']

let cache: ModFile[] | null = null

export async function gradleWrapperFiles(): Promise<ModFile[]> {
  if (cache) return cache
  cache = await Promise.all(
    FILES.map(async (path) => {
      const res = await fetch(`${import.meta.env.BASE_URL}gradle-wrapper/${path}`)
      if (!res.ok) throw new Error(`Wrapper Gradle introuvable : ${path}`)
      const bytes = new Uint8Array(await res.arrayBuffer())
      return {
        path,
        content: '',
        dataUrl: 'data:application/octet-stream;base64,' + bytesToBase64(bytes),
        generated: true,
        executable: path === 'gradlew',
      }
    }),
  )
  return cache
}
