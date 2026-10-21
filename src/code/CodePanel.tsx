import Editor from '@monaco-editor/react'
import { useMemo } from 'react'
import './monacoSetup'
import { Section } from '../components/ui'
import { buildMod, CUSTOM_CODE_TEMPLATE } from '../codegen/modProject'
import { packageName, screenClassNames } from '../codegen/names'
import { useProject, useUi } from '../project/store'

function languageOf(path: string) {
  if (path.endsWith('.java')) return 'java'
  if (path.endsWith('.json')) return 'json'
  if (path.endsWith('.toml') || path.endsWith('.properties')) return 'ini'
  if (path.endsWith('.md')) return 'markdown'
  return 'plaintext'
}

const dirOf = (p: string) => p.slice(0, p.lastIndexOf('/') + 1)
const baseOf = (p: string) => p.slice(p.lastIndexOf('/') + 1)

export default function CodePanel() {
  const project = useProject((s) => s.project)
  const update = useProject((s) => s.update)
  const { codeFile, set } = useUi()
  const build = useMemo(() => buildMod(project), [project])
  const files = build.files.filter((f) => !f.dataUrl)

  // Raccourcis venant des autres panneaux (« Voir le code Java »).
  let selectedPath = codeFile
  if (codeFile === 'logic') selectedPath = files.find((f) => f.path.endsWith('/ModEvents.java'))?.path ?? null
  else if (codeFile?.startsWith('screen:')) {
    const cls = screenClassNames(project.guis).get(codeFile.slice(7))
    selectedPath = files.find((f) => f.path.endsWith(`/screens/${cls}.java`))?.path ?? null
  }
  const file = files.find((f) => f.path === selectedPath) ?? files[0]

  const groups = useMemo(() => {
    const map = new Map<string, typeof files>()
    for (const f of files) {
      const d = dirOf(f.path)
      map.set(d, [...(map.get(d) ?? []), f])
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [files])

  return (
    <div className="panel two">
      <aside className="side">
        <Section title="Fichiers du mod">
          <div className="list file-tree">
            {groups.map(([dir, items]) => (
              <div key={dir}>
                {dir && <div className="file-dir">{dir}</div>}
                {items.map((f) => (
                  <div
                    key={f.path}
                    className={'list-item' + (f.path === file?.path ? ' selected' : '')}
                    onClick={() => set({ codeFile: f.path })}
                  >
                    <span className="grow">{baseOf(f.path)}</span>
                    {!f.generated && <span className="tag">modifiable</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Section>
        <Section title="À savoir">
          <p className="hint">
            Le code est généré à partir des nœuds et des interfaces : il est en lecture seule. Pour écrire du Java
            vous-même, utilisez <b>CustomCode.java</b> ou le nœud « Code Java ».
          </p>
        </Section>
      </aside>
      <div className="stage">
        {file && (
          <Editor
            key={file.path}
            theme="tessera"
            path={file.path}
            language={languageOf(file.path)}
            value={file.generated ? file.content : project.customCode || CUSTOM_CODE_TEMPLATE(packageName(project.meta))}
            onChange={(v) => !file.generated && update((p) => void (p.customCode = v ?? ''))}
            options={{
              readOnly: file.generated,
              readOnlyMessage: { value: 'Fichier généré par Tessera : modifiez les nœuds ou les interfaces.' },
              minimap: { enabled: false },
              fontSize: 13,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
            }}
          />
        )}
      </div>
    </div>
  )
}
