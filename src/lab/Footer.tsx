import { useEffect, useRef } from 'react'
import gsap from 'gsap'

import ShinyText from '@/components/ShinyText'
import { RollText } from '@/lab/primitives'

export default function Footer({ onTop }: { onTop: () => void }) {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.footer__letter', {
        yPercent: 100,
        stagger: 0.06,
        ease: 'expo.out',
        duration: 1.4,
        scrollTrigger: { trigger: '.footer__wordmark', start: 'top 95%' },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <footer id="contato" ref={root} className="footer">
      <div className="footer__lead">
        <p className="footer__line">
          Fim da <span className="serif">observação.</span>
        </p>
        <ShinyText
          text="Os espécimes continuam vivos depois que você sai."
          className="footer__shiny mono"
          color="#6f6b64"
          shineColor="#f4efe6"
          speed={3.2}
        />
      </div>

      <div className="footer__grid mono">
        <div>
          <p className="dim">Laboratório</p>
          <p>OVRA — Laboratório Visual</p>
          <p>Edição 2026</p>
        </div>
        <div>
          <p className="dim">Instrumentos</p>
          <p>React · OGL · GLSL</p>
          <p>GSAP · Lenis · React Bits</p>
        </div>
        <div>
          <p className="dim">Protocolo</p>
          <p>Mova · Arraste · Clique</p>
          <p>← → na câmara · Esc sai</p>
        </div>
        <div className="footer__top">
          <button type="button" className="chip" onClick={onTop} data-cursor>
            <RollText text="Voltar ao topo ↑" />
          </button>
        </div>
      </div>

      <p className="footer__wordmark" aria-hidden="true">
        {'OVRA'.split('').map((l, i) => (
          <span key={i} className="hero__mask">
            <span className="footer__letter">{l}</span>
          </span>
        ))}
      </p>
    </footer>
  )
}
