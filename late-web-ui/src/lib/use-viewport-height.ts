import { useEffect } from 'react'

/**
 * Track the true visible viewport height in CSS as `--vh`, accounting
 * for mobile browser chrome (URL bar, tab strip) and the soft keyboard
 * via `window.visualViewport`. CSS can then use `calc(var(--vh) * 100)`
 * in place of `100vh` / `100dvh`, which both lie on mobile (100vh
 * includes the URL bar, 100dvh updates only on resize).
 *
 * Soft-keyboard handling: when the keyboard pops up, the visual
 * viewport shrinks by hundreds of pixels in a single tick. If we
 * followed that signal blindly, every chat container would collapse
 * to half its size while the user types, leaving a blank stripe at
 * the top of the viewport. We detect a keyboard event as a sudden
 * drop of >= 120px that happens while an editable element is focused
 * (or within 250ms of focus being granted to one). Real window
 * resizes — drag the bottom edge of the desktop browser, rotate a
 * tablet, fold/unfold a foldable — still flow through.
 */
const KEYBOARD_THRESHOLD_PX = 120
let lastStableVh = 0

function isEditableFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if ((el as HTMLElement).isContentEditable) return true
  return false
}

export default function useViewportHeight() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const update = () => {
      const h = window.visualViewport?.height ?? window.innerHeight
      if (lastStableVh === 0) {
        lastStableVh = h
      } else {
        const delta = h - lastStableVh
        if (Math.abs(delta) >= KEYBOARD_THRESHOLD_PX && isEditableFocused()) {
          // Big jump while an input is focused — assume soft
          // keyboard. Freeze at the pre-keyboard height so the
          // layout doesn't collapse; the keyboard just overlaps
          // the bottom of the page, which is normal.
          return
        }
        lastStableVh = h
      }
      const vh = lastStableVh * 0.01
      document.documentElement.style.setProperty('--vh', `${vh}px`)
    }

    update()

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', update)
      window.visualViewport.addEventListener('scroll', update)
    }
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', update)
        window.visualViewport.removeEventListener('scroll', update)
      }
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])
}
