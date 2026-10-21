import JSZip from 'jszip'

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(text: string, filename: string, type = 'text/plain') {
  downloadBlob(new Blob([text], { type }), filename)
}

export interface ZipEntry {
  path: string
  content: string
  dataUrl?: string
}

export async function downloadZip(entries: ZipEntry[], filename: string) {
  const zip = new JSZip()
  for (const e of entries) {
    if (e.dataUrl) zip.file(e.path, e.dataUrl.split(',')[1] ?? '', { base64: true })
    else zip.file(e.path, e.content)
  }
  downloadBlob(await zip.generateAsync({ type: 'blob' }), filename)
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
