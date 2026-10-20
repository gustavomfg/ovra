import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

import { SPECIMENS, type Values } from '@/lab/specimens'
import { Corners, LiveSlot, RollText } from '@/lab/primitives'
import { Placeholder } from '@/lab/Catalogue'

const pad = (n: number) => String(n).padStart(2, '0')

function decimals(step: number) {
  const s = String(step)
  return s.includes('.') ? s.split('.')[1].length : 0
}

/**
 * Full-screen inspector for one specimen. It irises open from the point that was clicked,
 * exposes the specimen's parameters as live sliders, and walks the collection with ← →.
 */
export default function Chamber({
  index,
  origin,
  onIndex,
  onClose,
}: {
  index: number
  origin: { x: number; y: number }
  onIndex: (index: number) => void
  onClose: () => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const closing = useRef(false)
  const specimen = SPECIMENS[index]
  // Tweaks are kept per specimen, so walking the collection and back preserves them.
  const [tweaks, setTweaks] = useState<Record<string, Values>>({})
  const values = tweaks[specimen.id] ?? specimen.values
  const setValues = (next: Values) => setTweaks((prev) => ({ ...prev, [specimen.id]: next }))
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const at = `${origin.x}px ${origin.y}px`
    const ctx = gsap.context(() => {
      gsap
        .timeline()
        .fromTo(root.current, { clipPath: `circle(0% at ${at})` }, { clipPath: `circle(150% at ${at})`, duration: 1.1, ease: 'expo.inOut' })
        .from('.chamber__reveal', { y: 24, autoAlpha: 0, duration: 0.9, stagger: 0.06, ease: 'expo.out' }, '-=0.45')
    }, root)
    root.current?.focus()
    return () => ctx.revert()
  }, [origin])

  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    gsap.to(root.current, { clipPath: 'inset(0 0 100% 0)', duration: 0.8, ease: 'expo.inOut', onComplete: onClose })
  }, [onClose])

  const step = useCallback(
    (delta: number) => onIndex((index + delta + SPECIMENS.length) % SPECIMENS.length),
    [index, onIndex],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, step])

  const copy = async () => {
    const props = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v.toFixed(3))]))
    try {
      await navigator.clipboard.writeText(JSON.stringify(props, null, 2))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      // Clipboard can be unavailable in insecure contexts; the button simply does nothing.
    }
  }

  return (
    <div
      ref={root}
      className="chamber"
      role="dialog"
      aria-modal="true"
      aria-label={`Câmara de observação: ${specimen.name}`}
      tabIndex={-1}
      style={{ '--tint': specimen.tint } as React.CSSProperties}
    >
      <div className="chamber__stage">
        <LiveSlot key={specimen.id} margin="0px" placeholder={<Placeholder specimen={specimen} />}>
          {specimen.render(values, true)}
        </LiveSlot>
      </div>
      <div className="chamber__shade" aria-hidden="true" />

      <header className="chamber__top">
        <p className="chamber__reveal mono">
          Câmara de observação <span className="dim">— Nº {pad(index + 1)} / {pad(SPECIMENS.length)}</span>
        </p>
        <button type="button" className="chamber__close mono chamber__reveal" onClick={close} data-cursor>
          <RollText text="Fechar [Esc]" />
        </button>
      </header>

      <div className="chamber__title">
        <p className="chamber__reveal mono dim">
          {specimen.family} · <span className="serif">{specimen.latin}</span>
        </p>
        <h2 className="chamber__name chamber__reveal" key={specimen.id}>
          {specimen.name}
        </h2>
        <p className="chamber__note chamber__reveal">{specimen.note}</p>
      </div>

      <aside className="panel chamber__reveal" aria-label="Parâmetros">
        <Corners />
        <p className="panel__head mono">
          <span>Parâmetros</span>
          <span className="dim">ao vivo</span>
        </p>
        {specimen.controls.map((c) => {
          const v = values[c.key]
          const pct = ((v - c.min) / (c.max - c.min)) * 100
          return (
            <label key={c.key} className="control">
              <span className="control__row mono">
                <span>{c.label}</span>
                <output>{v.toFixed(decimals(c.step))}</output>
              </span>
              <input
                type="range"
                min={c.min}
                max={c.max}
                step={c.step}
                value={v}
                style={{ '--pct': `${pct}%` } as React.CSSProperties}
                onChange={(e) => setValues({ ...values, [c.key]: Number(e.target.value) })}
              />
            </label>
          )
        })}
        <div className="panel__actions">
          <button type="button" className="chip mono" onClick={() => setValues(specimen.values)} data-cursor>
            <RollText text="Restaurar" />
          </button>
          <button type="button" className="chip mono" onClick={copy} data-cursor>
            <RollText text={copied ? 'Copiado ✓' : 'Copiar props'} />
          </button>
        </div>
        <p className="panel__hint mono dim">Interaja com o espécime: mova, arraste, clique.</p>
      </aside>

      <nav className="chamber__nav" aria-label="Navegar espécimes">
        <button type="button" className="chamber__step chamber__reveal" onClick={() => step(-1)} data-cursor>
          <span className="mono dim">← Anterior</span>
          <span className="serif">{SPECIMENS[(index - 1 + SPECIMENS.length) % SPECIMENS.length].name}</span>
        </button>
        <div className="chamber__dots chamber__reveal" aria-hidden="true">
          {SPECIMENS.map((s, i) => (
            <i key={s.id} className={i === index ? 'on' : ''} />
          ))}
        </div>
        <button type="button" className="chamber__step chamber__step--next chamber__reveal" onClick={() => step(1)} data-cursor>
          <span className="mono dim">Próximo →</span>
          <span className="serif">{SPECIMENS[(index + 1) % SPECIMENS.length].name}</span>
        </button>
      </nav>
    </div>
  )
}
