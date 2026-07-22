import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react'

export type StreamInfo = {
  name: string
  url: string
  mount: string
  artist?: string
  title?: string
  category?: string
  emoji?: string
  accent?: string
}

export type TrackMeta = {
  artist: string | null
  title: string | null
  raw: string | null
}

interface AudioContextValue {
  current: StreamInfo | null
  track: TrackMeta | null
  setTrack: (t: TrackMeta | null) => void
  playing: boolean
  loading: boolean
  volume: number
  muted: boolean
  play: (s: StreamInfo) => void
  toggle: () => void
  stop: () => void
  setVolume: (v: number) => void
  toggleMute: () => void
  getAudioElement: () => HTMLAudioElement | null
  getAnalyser: () => AnalyserNode | null
}

const AudioCtx = createContext<AudioContextValue | null>(null)

export function useAudio() {
  const ctx = useContext(AudioCtx)
  if (!ctx) throw new Error('useAudio must be used within <AudioProvider>')
  return ctx
}

const VOLUME_KEY = 'late.audio.volume'
const MUTED_KEY = 'late.audio.muted'
const CURRENT_KEY = 'late.audio.current'
const PLAYING_KEY = 'late.audio.playing'

function loadCurrent(): StreamInfo | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StreamInfo
  } catch { return null }
}

function loadWasPlaying(): boolean {
  try {
    return localStorage.getItem(PLAYING_KEY) === '1'
  } catch { return false }
}

// Module-level singletons so the <audio> element, the AudioContext, and
// the AnalyserNode all survive the React tree. Without this, every
// page that mounts the MiniPlayer (Home, Icecast, Irc) would create a
// new AudioContext and a new MediaElementAudioSourceNode on the same
// <audio> element when navigating between pages — leaking contexts
// and, in some browsers, throwing "Already connected".
let sharedAudio: HTMLAudioElement | null = null
let sharedCtx: AudioContext | null = null
let sharedAnalyser: AnalyserNode | null = null
let listenersWired = false

function ensureSharedAudio(volume: number, muted: boolean): HTMLAudioElement {
  if (sharedAudio) return sharedAudio
  const a = new Audio()
  a.preload = 'none'
  a.volume = muted ? 0 : volume
  sharedAudio = a
  return a
}

function ensureAnalyser(): AnalyserNode | null {
  if (sharedAnalyser) return sharedAnalyser
  if (!sharedAudio) return null
  const Ctor = window.AudioContext || (window as any).webkitAudioContext
  if (!sharedCtx) sharedCtx = new Ctor()
  try {
    const source = sharedCtx.createMediaElementSource(sharedAudio)
    const analyser = sharedCtx.createAnalyser()
    analyser.fftSize = 512
    const gain = sharedCtx.createGain()
    gain.gain.value = 1
    source.connect(analyser)
    analyser.connect(gain)
    gain.connect(sharedCtx.destination)
    sharedAnalyser = analyser
  } catch (e) {
    console.warn('[audio] analyser create failed', e)
    return null
  }
  return sharedAnalyser
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<StreamInfo | null>(() => loadCurrent())
  const [track, setTrack] = useState<TrackMeta | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [volume, setVolumeState] = useState(() => {
    const v = localStorage.getItem(VOLUME_KEY)
    return v ? Number(v) : 0.7
  })
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTED_KEY) === '1')
  const wasPlaying = useRef(loadWasPlaying())

  const ensureAudioEl = useCallback(() => {
    return ensureSharedAudio(volume, muted)
  }, [muted, volume])

  // Restore the stream + autoplay on the first user gesture
  // after mount if the user had a channel playing before
  // refresh. Browsers (Chrome, Safari, Firefox) all block
  // unprompted audio, so we listen for the first
  // pointerdown/keydown on the document and call play() from
  // inside that handler. That satisfies the autoplay policy
  // because the call stack traces back to a user gesture.
  // If the user had a channel paused before refresh, nothing
  // happens — they have to hit play themselves.
  useEffect(() => {
    if (!wasPlaying.current) return
    const c = loadCurrent()
    if (!c) return
    wasPlaying.current = false
    setCurrent(c)
    setLoading(true)
    let done = false
    const tryPlay = () => {
      if (done) return
      const a = ensureSharedAudio(volume, muted)
      if (a.src !== c.url) a.src = c.url
      if (sharedCtx) sharedCtx.resume().catch(() => {})
      else ensureAnalyser()
      const p = a.play()
      if (p && typeof p.then === 'function') {
        p.then(() => { done = true; cleanup() })
          .catch(() => { /* wait for gesture */ })
      } else {
        done = true
        cleanup()
      }
    }
    const onGesture = () => {
      tryPlay()
    }
    const cleanup = () => {
      document.removeEventListener('pointerdown', onGesture, true)
      document.removeEventListener('keydown', onGesture, true)
      document.removeEventListener('touchstart', onGesture, true)
    }
    document.addEventListener('pointerdown', onGesture, true)
    document.addEventListener('keydown', onGesture, true)
    document.addEventListener('touchstart', onGesture, true)
    tryPlay()
    return cleanup
  }, [muted, volume])

  const play = useCallback((s: StreamInfo) => {
    const a = ensureAudioEl()
    setTrack(null)
    setCurrent(s)
    setLoading(true)
    if (a.src !== s.url) {
      a.src = s.url
    }
    if (sharedCtx) {
      sharedCtx.resume().catch(() => {})
    } else {
      ensureAnalyser()
    }
    localStorage.setItem(PLAYING_KEY, '1')
    a.play().catch(() => {
      setPlaying(false)
      setLoading(false)
      localStorage.setItem(PLAYING_KEY, '0')
    })
  }, [ensureAudioEl])

  const toggle = useCallback(() => {
    if (!sharedAudio) return
    if (sharedAudio.paused) {
      // The src may be empty after a stop() (which clears it) or
      // after a fresh restore from localStorage (where the audio
      // element is created lazily, with no src). Re-apply the
      // current stream's url so play() has something to load.
      if (!sharedAudio.src && current) {
        sharedAudio.src = current.url
      }
      if (sharedCtx) sharedCtx.resume().catch(() => {})
      localStorage.setItem(PLAYING_KEY, '1')
      sharedAudio.play().catch(() => {
        localStorage.setItem(PLAYING_KEY, '0')
      })
    } else {
      sharedAudio.pause()
      localStorage.setItem(PLAYING_KEY, '0')
    }
  }, [current])

  const stop = useCallback(() => {
    if (!sharedAudio) return
    sharedAudio.pause()
    sharedAudio.src = ''
    setCurrent(null)
    setTrack(null)
    setPlaying(false)
    localStorage.setItem(PLAYING_KEY, '0')
  }, [])

  const getAudioElement = () => sharedAudio
  const getAnalyser = () => sharedAnalyser || ensureAnalyser()

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v))
    setVolumeState(clamped)
    localStorage.setItem(VOLUME_KEY, String(clamped))
    if (sharedAudio && !muted) sharedAudio.volume = clamped
  }, [muted])

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev
      localStorage.setItem(MUTED_KEY, next ? '1' : '0')
      if (sharedAudio) sharedAudio.volume = next ? 0 : volume
      return next
    })
  }, [volume])

  // Wire native events on the shared audio element exactly once.
  useEffect(() => {
    if (listenersWired) return
    const a = ensureSharedAudio(
      Number(localStorage.getItem(VOLUME_KEY)) || 0.7,
      localStorage.getItem(MUTED_KEY) === '1',
    )
    const onPlaying = () => { setPlaying(true); setLoading(false); localStorage.setItem(PLAYING_KEY, '1') }
    const onPause = () => { setPlaying(false); localStorage.setItem(PLAYING_KEY, '0') }
    const onWaiting = () => setLoading(true)
    const onCanPlay = () => setLoading(false)
    const onError = () => { setPlaying(false); setLoading(false); localStorage.setItem(PLAYING_KEY, '0') }
    a.addEventListener('playing', onPlaying)
    a.addEventListener('pause', onPause)
    a.addEventListener('waiting', onWaiting)
    a.addEventListener('canplay', onCanPlay)
    a.addEventListener('error', onError)
    listenersWired = true
  }, [])

  // Sync volume changes
  useEffect(() => {
    if (sharedAudio) {
      sharedAudio.volume = muted ? 0 : volume
    }
  }, [muted, volume])

  // Persist current stream on every change so a hard refresh
  // shows the last-played channel. The PLAYING_KEY is written
  // explicitly from play/toggle/stop because we need it set
  // synchronously with the gesture, not after a render.
  useEffect(() => {
    if (current) localStorage.setItem(CURRENT_KEY, JSON.stringify(current))
    else localStorage.removeItem(CURRENT_KEY)
  }, [current])

  return (
    <AudioCtx.Provider
      value={{
        current, track, setTrack, playing, loading, volume, muted,
        play, toggle, stop, setVolume, toggleMute, getAudioElement, getAnalyser,
      }}
    >
      {children}
    </AudioCtx.Provider>
  )
}
