import { useEffect, useRef, useState } from 'react'
import { pickFile, readAsDataUrl } from '../lib/files'
import { pngDataUrl } from '../lib/png'

const SIZE = 16
type Tool = 'pencil' | 'eraser' | 'fill' | 'picker'

const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: 'pencil', label: 'Crayon', key: 'b' },
  { id: 'eraser', label: 'Gomme', key: 'e' },
  { id: 'fill', label: 'Remplir', key: 'f' },
  { id: 'picker', label: 'Pipette', key: 'i' },
]

const PALETTE = ['#000000', '#3f3f3f', '#7f7f7f', '#bfbfbf', '#ffffff', '#7a4a2a', '#c98a4b', '#e0b48a', '#c4573a', '#e5534b', '#d2a03a', '#f2d65c', '#34b866', '#5fe08a', '#3b78c4', '#7fb6f0', '#7c4ac4', '#d17ad8']

async function decode(dataUrl: string): Promise<Uint8ClampedArray> {
  // Renvoie toujours une copie 16×16, quelle que soit la taille de l'image d'origine.
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, 0, 0, SIZE, SIZE)
  return ctx.getImageData(0, 0, SIZE, SIZE).data
}

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')

/** Éditeur de texture 16×16. N'écrit dans le projet qu'au relâchement (une étape d'annulation par trait). */
export function TextureEditor({ value, onChange }: { value?: string; onChange: (dataUrl: string) => void }) {
  const [pixels, setPixelsState] = useState<Uint8ClampedArray>(() => new Uint8ClampedArray(SIZE * SIZE * 4))
  const pixelsRef = useRef(pixels)
  const setPixels = (next: Uint8ClampedArray) => {
    pixelsRef.current = next
    setPixelsState(next)
  }
  const [tool, setTool] = useState<Tool>('pencil')
  const [color, setColor] = useState('#34b866')
  const [grid, setGrid] = useState(true)
  const drawing = useRef(false)
  const last = useRef<readonly [number, number] | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let alive = true
    if (value) decode(value).then((d) => alive && setPixels(new Uint8ClampedArray(d)))
    else setPixels(new Uint8ClampedArray(SIZE * SIZE * 4))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      alive = false
    }
  }, [value])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), SIZE, SIZE), 0, 0)
  }, [pixels])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
      const found = TOOLS.find((x) => x.key === e.key)
      if (found) setTool(found.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const commit = (data: Uint8ClampedArray) => onChange(pngDataUrl(SIZE, SIZE, new Uint8Array(data)))

  const apply = (x: number, y: number, data: Uint8ClampedArray): Uint8ClampedArray => {
    const i = (y * SIZE + x) * 4
    const n = parseInt(color.slice(1), 16)
    const rgba = [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]
    if (tool === 'picker') {
      if (data[i + 3] > 0) setColor(hex(data[i], data[i + 1], data[i + 2]))
      setTool('pencil')
      return data
    }
    const next = new Uint8ClampedArray(data)
    if (tool === 'pencil') next.set(rgba, i)
    else if (tool === 'eraser') next.set([0, 0, 0, 0], i)
    else {
      const target = [...data.slice(i, i + 4)].join()
      if (target === rgba.join()) return data
      const stack = [[x, y]]
      while (stack.length) {
        const [cx, cy] = stack.pop()!
        if (cx < 0 || cy < 0 || cx >= SIZE || cy >= SIZE) continue
        const j = (cy * SIZE + cx) * 4
        if ([...next.slice(j, j + 4)].join() !== target) continue
        next.set(rgba, j)
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1])
      }
    }
    return next
  }

  const cell = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return [Math.floor(((e.clientX - r.left) / r.width) * SIZE), Math.floor(((e.clientY - r.top) / r.height) * SIZE)] as const
  }

  return (
    <div className="texture-editor">
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <div className="seg">
          {TOOLS.map((t) => (
            <button key={t.id} className={tool === t.id ? 'active' : ''} onClick={() => setTool(t.id)} title={`${t.label} (${t.key.toUpperCase()})`}>
              {t.label}
            </button>
          ))}
        </div>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Couleur" />
        <label className="row hint">
          <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} /> Grille
        </label>
        <button
          onClick={async () => {
            const f = await pickFile('image/png')
            if (f) commit(await decode(await readAsDataUrl(f)))
          }}
        >
          Importer un PNG
        </button>
        <button className="danger" onClick={() => commit(new Uint8ClampedArray(SIZE * SIZE * 4))}>
          Effacer
        </button>
      </div>
      <div className="palette">
        {PALETTE.map((c) => (
          <button key={c} className={'swatch-btn' + (c === color ? ' active' : '')} style={{ background: c }} onClick={() => setColor(c)} title={c} />
        ))}
      </div>
      <div className={'texture-canvas' + (grid ? ' grid' : '')}>
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            drawing.current = true
            const [x, y] = cell(e)
            last.current = [x, y]
            setPixels(apply(x, y, pixelsRef.current))
          }}
          onPointerMove={(e) => {
            if (!drawing.current || tool === 'fill' || tool === 'picker') return
            const [x, y] = cell(e)
            // Relie les points pour ne pas sauter de pixel quand la souris va vite.
            const [px, py] = last.current ?? [x, y]
            const steps = Math.max(Math.abs(x - px), Math.abs(y - py), 1)
            let data = pixelsRef.current
            for (let i = 1; i <= steps; i++) {
              const ix = Math.round(px + ((x - px) * i) / steps)
              const iy = Math.round(py + ((y - py) * i) / steps)
              if (ix >= 0 && iy >= 0 && ix < SIZE && iy < SIZE) data = apply(ix, iy, data)
            }
            last.current = [x, y]
            if (data !== pixelsRef.current) setPixels(data)
          }}
          onPointerUp={() => {
            if (!drawing.current) return
            drawing.current = false
            if (tool !== 'picker') commit(pixelsRef.current)
          }}
        />
      </div>
      <p className="hint">Raccourcis : B crayon, E gomme, F remplir, I pipette.</p>
    </div>
  )
}
