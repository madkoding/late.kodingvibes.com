/**
 * Notification sound: a synthesized "ding" bell tone.
 * The AudioContext is created lazily inside the user-gesture call stack
 * the first time a sound is requested. If AudioContext is unavailable
 * (older browsers, no user gesture yet), the function no-ops.
 *
 * The bell sound is two stacked sine partials (E5 + B5) with a
 * quick attack and a long exponential decay. The second partial is
 * slightly louder and decays faster, which is what makes it read as
 * a small bell rather than a blip.
 */
let sharedCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (sharedCtx) return sharedCtx
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext || (window as any).webkitAudioContext
  if (!Ctor) return null
  sharedCtx = new Ctor()
  return sharedCtx
}

export function ensureNotificationAudio(): void {
  // Pre-create the AudioContext on a user gesture so the sound
  // can play later without one (e.g. when a mention arrives in
  // the background). iOS Safari requires this.
  const ctx = getCtx()
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => { /* ignore */ })
  }
}

let currentVolume = 0.7

export function setVolume(v: number): void {
  currentVolume = Math.max(0, Math.min(1, v / 100))
}

export function playBuzz(volumeOverride?: number): void {
  const ctx = getCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => { /* ignore */ })
  }
  const vol = volumeOverride !== undefined ? volumeOverride / 100 : currentVolume
  const start = ctx.currentTime

  // Do La Do La Do La (C5 A4 C5 A4 C5 A4) over ~2 seconds.
  // Each note = ~333ms; the next note starts before the previous
  // fully decays, so they ring into each other like a bell pattern.
  const notes = [
    { freq: 523.25, t: 0.00 },
    { freq: 440.00, t: 0.33 },
    { freq: 523.25, t: 0.67 },
    { freq: 440.00, t: 1.00 },
    { freq: 523.25, t: 1.33 },
    { freq: 440.00, t: 1.67 },
  ]
  const noteLen = 0.45
  for (const n of notes) {
    const at = start + n.t
    // Fundamental
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(n.freq, at)
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(0.28 * vol, at + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0005, at + noteLen)
    o.connect(g)
    g.connect(ctx.destination)
    o.start(at)
    o.stop(at + noteLen + 0.02)
    // 3rd harmonic for bell shimmer
    const h = ctx.createOscillator()
    const hg = ctx.createGain()
    h.type = 'sine'
    h.frequency.setValueAtTime(n.freq * 3, at)
    hg.gain.setValueAtTime(0, at)
    hg.gain.linearRampToValueAtTime(0.10 * vol, at + 0.01)
    hg.gain.exponentialRampToValueAtTime(0.0005, at + noteLen * 0.6)
    h.connect(hg)
    hg.connect(ctx.destination)
    h.start(at)
    h.stop(at + noteLen * 0.65)
  }
}

export function playMentionBeep(): void {
  _playMentionBeep(currentVolume)
}

function _playMentionBeep(volume: number): void {
  const ctx = getCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => { /* ignore */ })
  }
  const now = ctx.currentTime
  const dur = 0.9

  const o1 = ctx.createOscillator()
  const g1 = ctx.createGain()
  o1.type = 'sine'
  o1.frequency.setValueAtTime(659.25, now)
  g1.gain.setValueAtTime(0, now)
  g1.gain.linearRampToValueAtTime(0.28 * volume, now + 0.005)
  g1.gain.exponentialRampToValueAtTime(0.0005, now + dur)
  o1.connect(g1)
  g1.connect(ctx.destination)
  o1.start(now)
  o1.stop(now + dur + 0.05)

  const o2 = ctx.createOscillator()
  const g2 = ctx.createGain()
  o2.type = 'sine'
  o2.frequency.setValueAtTime(987.77, now)
  g2.gain.setValueAtTime(0, now)
  g2.gain.linearRampToValueAtTime(0.16 * volume, now + 0.005)
  g2.gain.exponentialRampToValueAtTime(0.0005, now + dur * 0.55)
  o2.connect(g2)
  g2.connect(ctx.destination)
  o2.start(now)
  o2.stop(now + dur * 0.6)
}
