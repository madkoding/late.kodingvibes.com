import { useState, useEffect } from 'react'

export function useHeaderOffset() {
  const [headerHeight, setHeaderHeight] = useState(0)
  const [vh, setVh] = useState(() => {
    if (typeof window === 'undefined') return 0
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--vh')) || 0
  })

  useEffect(() => {
    const measure = () => {
      const header = document.querySelector('header.sticky')
      const h = header ? header.getBoundingClientRect().height : 0
      setHeaderHeight(prev => prev !== h ? h : prev)
      const vhStr = getComputedStyle(document.documentElement).getPropertyValue('--vh')
      const v = parseFloat(vhStr) || 0
      setVh(prev => prev !== v ? v : prev)
    }
    measure()
    const header = document.querySelector('header.sticky')
    let ro: ResizeObserver | null = null
    if (header && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure)
      ro.observe(header)
    }
    if (typeof ResizeObserver !== 'undefined') {
      const roAll = new ResizeObserver(measure)
      roAll.observe(document.documentElement)
    }
    window.addEventListener('resize', measure)
    const t1 = setTimeout(measure, 100)
    const t2 = setTimeout(measure, 500)
    return () => {
      if (ro) ro.disconnect()
      window.removeEventListener('resize', measure)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  return { headerHeight, vh }
}
