// Monaco embarqué localement (pas de CDN) pour fonctionner hors ligne dans l'application de bureau.
import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/editor/editor.api'
import 'monaco-editor/languages/definitions/java/register'
import 'monaco-editor/languages/definitions/ini/register'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'

self.MonacoEnvironment = { getWorker: () => new EditorWorker() }
loader.config({ monaco })

monaco.editor.defineTheme('tessera', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: { 'editor.background': '#16181d', 'editorGutter.background': '#16181d' },
})
