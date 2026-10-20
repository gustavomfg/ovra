import { useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'

import { FAMILIES, SPECIMENS, type Family, type Specimen } from '@/lab/specimens'
import { Corners, LiveSlot, RollText } from '@/lab/primitives'
import DecryptedText from '@/components/DecryptedText'

export function Placeholder({ specimen }: { specimen: Specimen }) {
  return (
    <div className="placeholder" style={{ '--tint': specimen.tint } as React.CSSProperties} aria-hidden="true">
      <span className="mono">Incubando…</span>
    </div>
  )
}

function Card({
  specimen,
  index,
  suspended,
  onOpen,
}: {
  specimen: Specimen
  index: number
  suspended: boolean
  onOpen: (index: number, origin: { x: number; y: number }) => void
}) {
  return (
    <li className={`card card--${specimen.span}`}>
      <button
        type="button"
        className="card__button"
        data-cursor
        onClick={(e) => onOpen(index, { x: e.clientX, y: e.clientY })}
        aria-label={`Abrir ${specimen.name}, espécime ${index + 1}`}
      >
        <div className="card__stage">
          <LiveSlot disabled={suspended} placeholder={<Placeholder specimen={specimen} />}>
            {specimen.render(specimen.values, false)}
          </LiveSlot>
          <Corners />
          <span className="card__tag mono">
            Nº {String(index + 1).padStart(2, '0')} <span className="dim">/ {specimen.family}</span>
          </span>
          <span className="card__open mono">Abrir câmara ↗</span>
        </div>
        <div className="card__caption">
          <h3 className="card__name">
            <RollText text={specimen.name} />
          </h3>
          <p className="card__latin serif">{specimen.latin}</p>
        </div>
      </button>
    </li>
  )
}

export default function Catalogue({
  suspended,
  onOpen,
}: {
  suspended: boolean
  onOpen: (index: number, origin: { x: number; y: number }) => void
}) {
  const root = useRef<HTMLElement>(null)
  const [family, setFamily] = useState<Family | null>(null)

  const visible = useMemo(
    () => SPECIMENS.map((s, i) => ({ s, i })).filter(({ s }) => !family || s.family === family),
    [family],
  )

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.card').forEach((card) => {
        gsap.from(card, {
          y: 80,
          clipPath: 'inset(18% 0 0 0)',
          duration: 1.3,
          ease: 'expo.out',
          scrollTrigger: { trigger: card, start: 'top 92%' },
        })
      })
    }, root)
    return () => ctx.revert()
  }, [family])

  return (
    <section id="especimes" ref={root} className="catalogue">
      <div className="section-head mono">
        <span>(02)</span>
        <DecryptedText text="Catálogo de espécimes" animateOn="view" sequential speed={40} />
        <span className="dim">{String(visible.length).padStart(2, '0')} em observação</span>
      </div>

      <div className="catalogue__intro">
        <h2 className="catalogue__title">
          Coleção <span className="serif">viva</span>
        </h2>
        <div className="filters" role="group" aria-label="Filtrar por família">
          {[null, ...FAMILIES].map((f) => (
            <button
              key={f ?? 'todos'}
              type="button"
              className="filter mono"
              aria-pressed={family === f}
              data-cursor
              onClick={() => setFamily(f)}
            >
              <RollText text={f ?? 'Todos'} />
            </button>
          ))}
        </div>
      </div>

      <ul className="grid">
        {visible.map(({ s, i }) => (
          <Card key={s.id} specimen={s} index={i} suspended={suspended} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  )
}
