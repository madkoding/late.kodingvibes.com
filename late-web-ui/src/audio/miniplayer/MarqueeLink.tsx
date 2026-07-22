import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

export function MarqueeLink({ to, text, className = '' }: { to: string; text: string; className?: string }) {
  const ref = useRef<HTMLAnchorElement | null>(null)
  const [overflow, setOverflow] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setOverflow(el.scrollWidth > el.clientWidth + 1)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [text])

  if (!overflow) {
    return (
      <Link ref={ref} to={to} className={`truncate min-w-0 ${className}`}>
        {text}
      </Link>
    )
  }

  return (
    <Link
      ref={ref}
      to={to}
      className={`marquee min-w-0 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="marquee__track">
        <span className="shrink-0">{text}</span>
        <span aria-hidden="true" className="shrink-0">{text}</span>
      </span>
    </Link>
  )
}
