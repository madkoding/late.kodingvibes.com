const COLLAPSED_KEY = 'late.player.collapsed'
const POS_KEY = 'late.player.pos'
const FLOATING_KEY = 'late.player.floating'

export function loadPos(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(POS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') return parsed
  } catch { /* ignore */ }
  return null
}

export function savePos(p: { x: number; y: number } | null) {
  if (!p) { localStorage.removeItem(POS_KEY); return }
  localStorage.setItem(POS_KEY, JSON.stringify(p))
}

export function loadCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSED_KEY) === '1' } catch { return false }
}

export function saveCollapsed(v: boolean) {
  try { localStorage.setItem(COLLAPSED_KEY, v ? '1' : '0') } catch { /* ignore */ }
}

export function loadFloating(): boolean {
  try { return localStorage.getItem(FLOATING_KEY) === '1' } catch { return false }
}

export function saveFloating(v: boolean) {
  try { localStorage.setItem(FLOATING_KEY, v ? '1' : '0') } catch { /* ignore */ }
}

export const EXPANDED_W = 26 * 16
export const COLLAPSED_W = 132
export const DEFAULT_H = 64
export const GUTTER = 16

export function defaultPos(): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 16, y: 16 }
  return {
    x: Math.max(8, window.innerWidth - EXPANDED_W - GUTTER),
    y: Math.max(8, window.innerHeight - DEFAULT_H - GUTTER),
  }
}

export function clampPos(p: { x: number; y: number }, cardW: number, cardH: number) {
  if (typeof window === 'undefined') return p
  const maxX = Math.max(0, window.innerWidth - cardW)
  const maxY = Math.max(0, window.innerHeight - cardH)
  return {
    x: Math.max(0, Math.min(maxX, p.x)),
    y: Math.max(0, Math.min(maxY, p.y)),
  }
}
