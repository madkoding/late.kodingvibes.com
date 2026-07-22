import { forwardRef, useRef, useCallback, useEffect } from 'react'

function defaultPos() {
  return {
    x: Math.max(16, window.innerWidth - 320 - 16),
    y: Math.max(80, window.innerHeight - 80 - 240),
  }
}

interface FloatingVideoContainerProps {
  visible: string | null
  onClose: () => void
}

const FloatingVideoContainer = forwardRef<HTMLDivElement, FloatingVideoContainerProps>(
  function FloatingVideoContainer({ visible, onClose }, ref) {
    const posRef = useRef(defaultPos())
    const dragRef = useRef<{ dx: number; dy: number } | null>(null)
    const containerRef = useRef<HTMLDivElement | null>(null)

    const syncRef = (el: HTMLDivElement | null) => {
      containerRef.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el
    }

    useEffect(() => {
      if (visible) {
        const p = defaultPos()
        posRef.current = p
        const el = containerRef.current
        if (el) {
          el.style.left = p.x + 'px'
          el.style.top = p.y + 'px'
        }
      }
    }, [visible])

    const onPointerDown = useCallback((e: React.PointerEvent) => {
      const el = containerRef.current
      if (!el) return
      if ((e.target as HTMLElement).closest('button')) return
      e.preventDefault()
      el.setPointerCapture(e.pointerId)
      dragRef.current = {
        dx: e.clientX - posRef.current.x,
        dy: e.clientY - posRef.current.y,
      }
    }, [])

    const onPointerMove = useCallback((e: React.PointerEvent) => {
      if (!dragRef.current) return
      const el = containerRef.current
      if (!el) return
      const x = e.clientX - dragRef.current.dx
      const y = e.clientY - dragRef.current.dy
      posRef.current = { x, y }
      el.style.left = x + 'px'
      el.style.top = y + 'px'
    }, [])

    const onPointerUp = useCallback(() => {
      dragRef.current = null
    }, [])

    return (
      <div
        ref={syncRef}
        className={`fixed z-50 w-72 sm:w-80 rounded-xl border border-slate-700/60 bg-slate-950/95 backdrop-blur-sm shadow-2xl overflow-hidden select-none ${visible ? '' : 'hidden'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="h-7 bg-slate-900/90 border-b border-slate-800 flex items-center px-2 cursor-grab active:cursor-grabbing touch-none">
          <span className="text-[10px] text-slate-500">Video flotante</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose() }}
            className="ml-auto w-5 h-5 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            aria-label="Cerrar video flotante"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </div>
    )
  }
)

export default FloatingVideoContainer
