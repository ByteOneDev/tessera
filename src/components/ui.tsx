import { useEffect, useState, type ReactNode } from 'react'
import type { Vec3 } from '../project/types'

export function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="section">
      <div className="section-title">
        <span>{title}</span>
        {actions && <div className="row">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
}

/** Champ numérique qui tolère une saisie intermédiaire (« - », « 1. ») avant de valider. */
export function NumberInput({
  value,
  onChange,
  step = 1,
  min,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => {
    if (Number(text.replace(',', '.')) !== value) setText(String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <input
      type="number"
      step={step}
      min={min}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const v = Number(e.target.value.replace(',', '.'))
        if (e.target.value.trim() !== '' && Number.isFinite(v)) onChange(min !== undefined ? Math.max(min, v) : v)
      }}
      onBlur={() => setText(String(value))}
    />
  )
}

const AXIS_COLORS = ['#e5534b', '#5fb760', '#3b78c4']

export function Vec3Input({
  value,
  onChange,
  step = 1,
  min,
}: {
  value: Vec3
  onChange: (v: Vec3) => void
  step?: number
  min?: number
}) {
  return (
    <div className="vec3">
      {(['X', 'Y', 'Z'] as const).map((axis, i) => (
        <div className="axis" key={axis}>
          <span style={{ color: AXIS_COLORS[i] }}>{axis}</span>
          <NumberInput
            value={value[i]}
            step={step}
            min={min}
            onChange={(v) => {
              const next = [...value] as Vec3
              next[i] = v
              onChange(next)
            }}
          />
        </div>
      ))}
    </div>
  )
}

export function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="row">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      <input value={value} onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && onChange(e.target.value)} />
    </div>
  )
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

/** Ignore les raccourcis clavier quand l'utilisateur tape dans un champ. */
export function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}
