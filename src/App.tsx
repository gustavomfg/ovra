import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

import Noise from '@/components/Noise'
import TargetCursor from '@/components/TargetCursor'
import Loader from '@/lab/Loader'
import Hero, { Header } from '@/lab/Hero'
import Manifesto from '@/lab/Manifesto'
import Catalogue from '@/lab/Catalogue'
import Footer from '@/lab/Footer'
import { useReducedMotion } from '@/lab/hooks'

const Chamber = lazy(() => import('@/lab/Chamber'))

gsap.registerPlugin(ScrollTrigger)

const finePointer = window.matchMedia('(pointer: fine)').matches

export default function App() {
  const reduced = useReducedMotion()
  const [ready, setReady] = useState(reduced)
  const [open, setOpen] = useState<{ index: number; origin: { x: number; y: number } } | null>(null)
  const lenis = useRef<Lenis | null>(null)

  useEffect(() => {
    if (reduced) return
    const instance = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 })
    lenis.current = instance
    instance.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => instance.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(tick)
      instance.destroy()
      lenis.current = null
    }
  }, [reduced])

  // Freeze the page while the loader runs or a chamber is open.
  useEffect(() => {
    const locked = !ready || open !== null
    document.documentElement.classList.toggle('locked', locked)
    if (locked) lenis.current?.stop()
    else lenis.current?.start()
  }, [ready, open])

  const navigate = useCallback((id: string) => {
    const target = document.getElementById(id)
    if (!target) return
    if (lenis.current) lenis.current.scrollTo(target, { duration: 1.8 })
    else target.scrollIntoView()
  }, [])

  const onLoaded = useCallback(() => setReady(true), [])

  return (
    <>
      {!ready && <Loader onDone={onLoaded} />}
      <Header onNavigate={navigate} />
      <main>
        <Hero ready={ready} suspended={open !== null} />
        <Manifesto />
        <Catalogue suspended={open !== null} onOpen={(index, origin) => setOpen({ index, origin })} />
      </main>
      <Footer onTop={() => navigate('topo')} />

      {open && (
        <Suspense fallback={null}>
          <Chamber
            index={open.index}
            origin={open.origin}
            onIndex={(index) => setOpen((o) => (o ? { ...o, index } : o))}
            onClose={() => setOpen(null)}
          />
        </Suspense>
      )}

      <Noise opacity={0.07} fixed zIndex={90} fps={18} />
      {finePointer && !reduced && (
        <TargetCursor targetSelector="[data-cursor]" cursorColor="#f4efe6" cursorColorOnTarget="#ff5b1f" spinDuration={3} />
      )}
    </>
  )
}
