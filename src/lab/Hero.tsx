import { useEffect, useRef } from 'react'
import gsap from 'gsap'

import { LiquidEther } from '@/lab/specimens'
import { LiveSlot, RollText } from '@/lab/primitives'
import { useClock, useFps } from '@/lab/hooks'

export function Header({ onNavigate }: { onNavigate: (id: string) => void }) {
  const time = useClock()
  const fps = useFps()

  return (
    <header className="header">
      <a
        className="header__brand"
        href="#topo"
        data-cursor
        onClick={(e) => {
          e.preventDefault()
          onNavigate('topo')
        }}
      >
        <span className="header__dot" aria-hidden="true" />
        <RollText text="OVRA" />
        <span className="mono header__dim">LAB/26</span>
      </a>
      <nav className="header__nav" aria-label="Seções">
        {[
          ['manifesto', 'Manifesto'],
          ['especimes', 'Espécimes'],
          ['contato', 'Fim'],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="mono"
            data-cursor
            onClick={(e) => {
              e.preventDefault()
              onNavigate(id)
            }}
          >
            <RollText text={label} />
          </a>
        ))}
      </nav>
      <p className="header__readout mono" aria-hidden="true">
        <span>{time}</span>
        <span className="header__dim">{String(fps).padStart(3, '0')} FPS</span>
      </p>
    </header>
  )
}

export default function Hero({ ready, suspended }: { ready: boolean; suspended: boolean }) {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!ready) return
    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: 'expo.out' } })
        .from('.hero__letter', { yPercent: 115, duration: 1.6, stagger: 0.08 })
        .from('.hero__meta > *', { autoAlpha: 0, y: 14, duration: 1.1, stagger: 0.08 }, '-=1.2')
        .from('.hero__rule', { scaleX: 0, duration: 1.4, ease: 'expo.inOut' }, '-=1.4')

      // The wordmark sinks and blurs as the page scrolls away from it.
      gsap.to('.hero__wordmark', {
        yPercent: 18,
        opacity: 0.15,
        ease: 'none',
        scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom top', scrub: true },
      })
    }, root)
    return () => ctx.revert()
  }, [ready])

  return (
    <section id="topo" ref={root} className="hero" aria-label="OVRA">
      <div className="hero__field">
        <LiveSlot disabled={!ready || suspended} margin="0px">
          <LiquidEther
            colors={['#2b1d6b', '#ff5b1f', '#f4efe6']}
            mouseForce={24}
            cursorSize={120}
            autoIntensity={2.6}
            resolution={0.5}
          />
        </LiveSlot>
      </div>
      <div className="hero__vignette" aria-hidden="true" />

      <div className="hero__meta hero__meta--top mono">
        <p>
          Laboratório visual
          <br />
          <span className="dim">de luz, matéria e ruído</span>
        </p>
        <p className="hero__center">
          12 espécimes vivos
          <br />
          <span className="dim">renderizados em tempo real</span>
        </p>
        <p className="hero__right">
          Mova o cursor
          <br />
          <span className="dim">o éter responde ↘</span>
        </p>
      </div>

      <h1 className="hero__wordmark" aria-label="OVRA">
        {'OVRA'.split('').map((l, i) => (
          <span key={i} className="hero__mask" aria-hidden="true">
            <span className="hero__letter">{l}</span>
          </span>
        ))}
      </h1>

      <div className="hero__meta hero__meta--bottom mono">
        <span className="hero__rule" aria-hidden="true" />
        <p>Nº 00 — Éter, o meio</p>
        <p className="hero__center">Continue rolando</p>
        <p className="hero__right">S 23°33′ · W 46°38′</p>
      </div>
    </section>
  )
}
