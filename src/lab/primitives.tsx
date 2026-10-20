import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Letters that roll up to a duplicate of themselves on hover, staggered per character.
 * The duplicate layer is decorative; the accessible name stays the plain string.
 */
export function RollText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={`roll ${className}`} aria-label={text}>
      {[...text].map((char, i) => (
        <span key={i} className="roll__char" style={{ '--i': i } as React.CSSProperties} aria-hidden="true">
          <span>{char === ' ' ? ' ' : char}</span>
          <span>{char === ' ' ? ' ' : char}</span>
        </span>
      ))}
    </span>
  )
}

/**
 * Mounts its children only while the slot is near the viewport, so the page never holds
 * more live WebGL contexts than the screen can show. Unmounts lazily to avoid thrash.
 */
export function LiveSlot({
  children,
  placeholder,
  disabled = false,
  margin = '25% 0px',
}: {
  children: ReactNode
  placeholder?: ReactNode
  disabled?: boolean
  margin?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    let timeout = 0
    const observer = new IntersectionObserver(
      ([entry]) => {
        window.clearTimeout(timeout)
        if (entry.isIntersecting) setVisible(true)
        else timeout = window.setTimeout(() => setVisible(false), 500)
      },
      { rootMargin: margin },
    )
    observer.observe(node)
    return () => {
      window.clearTimeout(timeout)
      observer.disconnect()
    }
  }, [margin])

  const live = visible && !disabled

  return (
    <div ref={ref} className="slot">
      {!live && placeholder}
      {live && <Suspense fallback={placeholder ?? null}>{children}</Suspense>}
    </div>
  )
}

/** Four registration marks pinned to the corners of the nearest positioned parent. */
export function Corners() {
  return (
    <span className="corners" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}
