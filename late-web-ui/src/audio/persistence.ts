const VOLUME_KEY = 'late.audio.volume'
const MUTED_KEY = 'late.audio.muted'
const CURRENT_KEY = 'late.audio.current'
const PLAYING_KEY = 'late.audio.playing'

export function loadVolume(): number {
  try {
    const v = localStorage.getItem(VOLUME_KEY)
    return v ? Number(v) : 0.7
  } catch { return 0.7 }
}

export function saveVolume(v: number) {
  try { localStorage.setItem(VOLUME_KEY, String(v)) } catch { /* ignore */ }
}

export function loadMuted(): boolean {
  try { return localStorage.getItem(MUTED_KEY) === '1' } catch { return false }
}

export function saveMuted(muted: boolean) {
  try { localStorage.setItem(MUTED_KEY, muted ? '1' : '0') } catch { /* ignore */ }
}

export function loadCurrent<T>(): T | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch { return null }
}

export function saveCurrent<T>(current: T | null) {
  try {
    if (current) localStorage.setItem(CURRENT_KEY, JSON.stringify(current))
    else localStorage.removeItem(CURRENT_KEY)
  } catch { /* ignore */ }
}

export function loadWasPlaying(): boolean {
  try { return localStorage.getItem(PLAYING_KEY) === '1' } catch { return false }
}

export function savePlaying(playing: boolean) {
  try { localStorage.setItem(PLAYING_KEY, playing ? '1' : '0') } catch { /* ignore */ }
}
