import { useEffect, useRef } from 'react'
import gsap from 'gsap'

import ScrollVelocity from '@/components/ScrollVelocity'
import DecryptedText from '@/components/DecryptedText'

// Words wrapped in *asterisks* are set in the italic serif.
const MANIFESTO =
  'OVRA é um laboratório. Aqui não se fabricam produtos — cultivam-se *espécimes:* doze organismos de luz, matéria e ruído, escritos em shaders e mantidos vivos a sessenta quadros por segundo. Nenhum deles é um vídeo. Nenhum se repete. *Toque neles.* Eles respondem.'

export default function Manifesto() {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.manifesto__word',
        { opacity: 0.12 },
        {
          opacity: 1,
          stagger: 0.05,
          ease: 'none',
          scrollTrigger: { trigger: '.manifesto__text', start: 'top 80%', end: 'bottom 45%', scrub: 0.6 },
        },
      )
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section id="manifesto" ref={root} className="manifesto">
      <div className="section-head mono">
        <span>(01)</span>
        <DecryptedText text="Manifesto" animateOn="view" sequential speed={40} />
        <span className="dim">Por que um laboratório</span>
      </div>

      <p className="manifesto__text">
        {MANIFESTO.split(' ').map((word, i) => {
          const serif = word.startsWith('*')
          const clean = word.replaceAll('*', '')
          return (
            <span key={i} className={`manifesto__word${serif ? ' serif' : ''}`}>
              {clean}{' '}
            </span>
          )
        })}
      </p>

      <dl className="manifesto__facts mono">
        {[
          ['12', 'Espécimes'],
          ['05', 'Famílias'],
          ['60', 'Quadros / s'],
          ['0', 'Vídeos pré-gravados'],
        ].map(([value, label]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="marquee" aria-hidden="true">
        <ScrollVelocity
          texts={['Luz ✳ Matéria ✳ Ruído ✳ Sinal ✳ ', 'Shader ✳ Fluido ✳ Cosmos ✳ Tempo ✳ ']}
          velocity={60}
          className="marquee__text"
          outlineAlternate
        />
      </div>
    </section>
  )
}
