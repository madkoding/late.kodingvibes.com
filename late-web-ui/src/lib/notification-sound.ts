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
  const now = ctx.currentTime

  // Recreates the 003.mp3 notification chime: continuous tone
  // with fundamental ~200→260 Hz and a 4× harmonic ~800 Hz.
  const dur = 0.75

  // Fundamental: rising from ~200 Hz to ~260 Hz
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(195, now)
  osc.frequency.linearRampToValueAtTime(260, now + dur * 0.6)
  osc.frequency.linearRampToValueAtTime(220, now + dur)
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.28 * vol, now + 0.03)
  gain.gain.linearRampToValueAtTime(0.22 * vol, now + dur * 0.6)
  gain.gain.exponentialRampToValueAtTime(0.0005, now + dur)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + dur + 0.05)

  // 4th harmonic ~780→1040 Hz for the metallic chime character
  const h2 = ctx.createOscillator()
  const g2 = ctx.createGain()
  h2.type = 'sine'
  h2.frequency.setValueAtTime(780, now)
  h2.frequency.linearRampToValueAtTime(1040, now + dur * 0.6)
  h2.frequency.linearRampToValueAtTime(880, now + dur)
  g2.gain.setValueAtTime(0, now)
  g2.gain.linearRampToValueAtTime(0.16 * vol, now + 0.025)
  g2.gain.linearRampToValueAtTime(0.10 * vol, now + dur * 0.5)
  g2.gain.exponentialRampToValueAtTime(0.0005, now + dur * 0.9)
  h2.connect(g2)
  g2.connect(ctx.destination)
  h2.start(now)
  h2.stop(now + dur + 0.05)
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
