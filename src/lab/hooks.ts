import { useEffect, useState } from 'react'

export function useReducedMotion() {
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  return reduced
}

/** Frames per second, sampled twice a second. A lab should show its instruments. */
export function useFps() {
  const [fps, setFps] = useState(60)
  useEffect(() => {
    let frames = 0
    let last = performance.now()
    let raf = 0
    const tick = (now: number) => {
      frames++
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)))
        frames = 0
        last = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return fps
}

export function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return now.toLocaleTimeString('pt-BR', { hour12: false })
}
