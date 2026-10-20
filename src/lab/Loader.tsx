import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

const CELLS = 32
const GLYPHS = '=+-'

/**
 * ASCII boot sequence. The bar fills as fonts arrive and a minimum dwell passes, then the
 * whole panel lifts away like a shutter.
 */
export default function Loader({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)
  const [noise, setNoise] = useState('')

  useEffect(() => {
    const state = { p: 0 }
    const fonts = document.fonts?.ready ?? Promise.resolve()
    const tween = gsap.to(state, {
      p: 0.86,
      duration: 1.4,
      ease: 'power2.out',
      onUpdate: () => setProgress(state.p),
    })

    let cancelled = false
    void fonts.then(() => {
      if (cancelled) return
      tween.kill()
      gsap
        .timeline()
        .to(state, { p: 1, duration: 0.6, ease: 'power3.inOut', onUpdate: () => setProgress(state.p) })
        .to('.loader__line', { yPercent: -110, duration: 0.7, ease: 'power3.in', stagger: 0.05 }, '+=0.15')
        .to(root.current, { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, '-=0.3')
        .add(onDone, '-=0.55')
    })

    const scramble = window.setInterval(() => {
      setNoise(Array.from({ length: CELLS }, () => GLYPHS[(Math.random() * GLYPHS.length) | 0]).join(''))
    }, 70)

    return () => {
      cancelled = true
      tween.kill()
      window.clearInterval(scramble)
    }
  }, [onDone])

  const filled = Math.round(progress * CELLS)
  const bar = noise.slice(0, filled).padEnd(CELLS, '·')

  return (
    <div ref={root} className="loader" role="status" aria-label="Carregando o laboratório">
      <div className="loader__mask">
        <p className="loader__line mono">OVRA / LABORATÓRIO VISUAL — INCUBANDO ESPÉCIMES</p>
      </div>
      <div className="loader__mask">
        <p className="loader__line loader__bar mono" aria-hidden="true">
          [{bar}]
        </p>
      </div>
      <div className="loader__mask">
        <p className="loader__line loader__count">{String(Math.round(progress * 100)).padStart(3, '0')}</p>
      </div>
    </div>
  )
}
