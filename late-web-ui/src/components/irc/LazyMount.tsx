import { useEffect, useRef, useState } from 'react'

interface LazyMountProps {
  rootMargin?: string
  minHeight?: number
  children: React.ReactNode
}

/**
 * Defers mounting of heavy children (audio waveforms that fetch+decode
 * on mount, link previews, images) until the placeholder is near the
 * viewport. Without this, every audio in the loaded history fetches
 * and decodes in parallel on channel open, inflating the container
 * and pushing the last messages off-screen.
 */
export default function LazyMount({ rootMargin = '200px', minHeight = 40, children }: LazyMountProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
            break
          }
        }
      },
      { rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin])

  return (
    <div ref={ref} style={visible ? undefined : { minHeight }}>
      {visible ? children : null}
    </div>
  )
}
