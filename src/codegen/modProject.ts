// Assemble tous les fichiers d'un projet de mod NeoForge 1.21.1 (ModDevGradle).
import type { Project } from '../project/types'
import { generateLogic, type Diagnostic } from './logic'
import { MOD_ID_RE, mainClassName, packageName, screenClassNames } from './names'
import { generateModClient, generateScreen } from './screens'

export const MINECRAFT_VERSION = '1.21.1'
// Versions à jour : https://projects.neoforged.net/neoforged/neoforge et .../neoforged/moddevgradle
export const NEOFORGE_VERSION = '21.1.172'
export const MODDEVGRADLE_VERSION = '2.0.95'

export interface ModFile {
  path: string
  content: string
  /** Contenu binaire en data URL (images). */
  dataUrl?: string
  /** Fichier généré par Tessera (lecture seule dans le panneau Code). */
  generated: boolean
}

export interface ModBuild {
  files: ModFile[]
  diagnostics: Diagnostic[]
}

export const CUSTOM_CODE_TEMPLATE = (pkg: string) => `package ${pkg};

// Votre code Java. Ce fichier n'est jamais réécrit par Tessera.
// Appelez CustomCode.init() depuis un nœud « Code Java », ou ajoutez vos propres @SubscribeEvent ici.

public final class CustomCode {
    private CustomCode() {}

    public static void init() {
    }
}
`

const tomlString = (s: string) => JSON.stringify(s)

export function buildMod(project: Project): ModBuild {
  const { meta } = project
  const pkg = packageName(meta)
  const pkgPath = pkg.replace(/\./g, '/')
  const main = mainClassName(meta)
  const java = `src/main/java/${pkgPath}`
  const res = 'src/main/resources'
  const diagnostics: Diagnostic[] = []

  if (!MOD_ID_RE.test(meta.modId)) {
    diagnostics.push({
      level: 'error',
      message: `Mod id invalide « ${meta.modId} » : 2 à 64 caractères, minuscules, chiffres et _ uniquement, en commençant par une lettre.`,
    })
  }

  const logic = generateLogic(project)
  diagnostics.push(...logic.diagnostics)
  const screens = screenClassNames(project.guis)

  const files: ModFile[] = []
  const add = (path: string, content: string, generated = true) => files.push({ path, content, generated })

  add(
    `${java}/${main}.java`,
    `package ${pkg};

// Généré par Tessera : classe principale du mod.

import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.ModContainer;
import net.neoforged.fml.common.Mod;

@Mod(${main}.MODID)
public class ${main} {
    public static final String MODID = "${meta.modId}";

    public ${main}(IEventBus modEventBus, ModContainer modContainer) {
    }
}
`,
  )
  add(`${java}/ModEvents.java`, logic.modEvents)
  add(`${java}/client/ModClientEvents.java`, logic.clientEvents)
  add(`${java}/client/ModKeys.java`, logic.keys)
  add(`${java}/client/ModClient.java`, generateModClient(project))

  for (const gui of project.guis) {
    const cls = screens.get(gui.id)
    if (!cls) continue
    const { source, assets } = generateScreen(project, gui, cls, screens)
    add(`${java}/client/screens/${cls}.java`, source)
    for (const a of assets) files.push({ path: `${res}/${a.path}`, content: '', dataUrl: a.dataUrl, generated: true })
  }

  add(`${java}/CustomCode.java`, project.customCode || CUSTOM_CODE_TEMPLATE(pkg), false)

  add(
    `${res}/META-INF/neoforge.mods.toml`,
    `modLoader = "javafml"
loaderVersion = "[4,)"
license = "All Rights Reserved"

[[mods]]
modId = ${tomlString(meta.modId)}
version = ${tomlString(meta.version)}
displayName = ${tomlString(meta.name)}
authors = ${tomlString(meta.authors)}
description = ${tomlString(meta.description)}

[[dependencies.${meta.modId}]]
modId = "neoforge"
type = "required"
versionRange = "[21.1.0,)"
ordering = "NONE"
side = "BOTH"

[[dependencies.${meta.modId}]]
modId = "minecraft"
type = "required"
versionRange = "[1.21.1,1.21.2)"
ordering = "NONE"
side = "BOTH"
`,
  )
  add(`${res}/assets/${meta.modId}/lang/en_us.json`, JSON.stringify(logic.langEntries, null, 2) + '\n')

  add(
    'gradle.properties',
    `org.gradle.jvmargs=-Xmx2G
org.gradle.daemon=true
org.gradle.parallel=true
org.gradle.caching=true

minecraft_version=${MINECRAFT_VERSION}
neo_version=${NEOFORGE_VERSION}

mod_id=${meta.modId}
mod_version=${meta.version}
mod_group_id=${pkg}
`,
  )
  add(
    'settings.gradle',
    `pluginManagement {
    repositories {
        gradlePluginPortal()
        maven { url = 'https://maven.neoforged.net/releases' }
    }
}

plugins {
    // Télécharge automatiquement le JDK 21 si besoin.
    id 'org.gradle.toolchains.foojay-resolver-convention' version '0.9.0'
}

rootProject.name = '${meta.modId}'
`,
  )
  add(
    'build.gradle',
    `plugins {
    id 'java-library'
    id 'net.neoforged.moddev' version '${MODDEVGRADLE_VERSION}'
}

version = mod_version
group = mod_group_id

base {
    archivesName = mod_id
}

java.toolchain.languageVersion = JavaLanguageVersion.of(21)

neoForge {
    version = project.neo_version

    runs {
        client {
            client()
        }
        server {
            server()
            programArgument '--nogui'
        }
    }

    mods {
        "\${mod_id}" {
            sourceSet(sourceSets.main)
        }
    }
}

tasks.withType(JavaCompile).configureEach {
    options.encoding = 'UTF-8'
}
`,
  )
  add(
    'README.md',
    `# ${meta.name}

Mod NeoForge ${MINECRAFT_VERSION} généré par Tessera.

## Compiler

Il faut Java 21 et Gradle 8.10 ou plus récent.

\`\`\`bash
gradle wrapper
./gradlew build
\`\`\`

Le mod se trouve ensuite dans \`build/libs/${meta.modId}-${meta.version}.jar\` : copiez-le dans le dossier \`mods/\` de Minecraft.

Pour tester directement : \`./gradlew runClient\`.
`,
  )

  return { files, diagnostics }
}
