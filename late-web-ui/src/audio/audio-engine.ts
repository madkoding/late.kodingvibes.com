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

export class AudioEngine {
  private audio: HTMLAudioElement | null = null
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private listenersWired = false

  getAudioElement(): HTMLAudioElement {
    if (!this.audio) {
      const a = new Audio()
      a.preload = 'none'
      this.audio = a
    }
    return this.audio
  }

  getAnalyser(): AnalyserNode | null {
    if (this.analyser) return this.analyser
    if (!this.audio) return null
    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    if (!this.ctx) this.ctx = new Ctor()
    try {
      const source = this.ctx.createMediaElementSource(this.audio)
      const analyser = this.ctx.createAnalyser()
      analyser.fftSize = 512
      const gain = this.ctx.createGain()
      gain.gain.value = 1
      source.connect(analyser)
      analyser.connect(gain)
      gain.connect(this.ctx.destination)
      this.analyser = analyser
    } catch { return null }
    return this.analyser
  }

  setVolume(v: number) {
    if (this.audio) this.audio.volume = Math.max(0, Math.min(1, v))
  }

  play(url: string): Promise<void> {
    const a = this.getAudioElement()
    if (a.src !== url) a.src = url
    if (this.ctx) this.ctx.resume().catch(() => {})
    else this.getAnalyser()
    return a.play()
  }

  pause() {
    this.audio?.pause()
  }

  stop() {
    if (!this.audio) return
    this.audio.pause()
    this.audio.src = ''
  }

  get playing(): boolean {
    return this.audio ? !this.audio.paused : false
  }

  get currentSrc(): string {
    return this.audio?.src ?? ''
  }

  wireListeners(handlers: {
    onPlaying: () => void
    onPause: () => void
    onWaiting: () => void
    onCanPlay: () => void
    onError: () => void
  }) {
    if (this.listenersWired) return
    const a = this.getAudioElement()
    a.addEventListener('playing', handlers.onPlaying)
    a.addEventListener('pause', handlers.onPause)
    a.addEventListener('waiting', handlers.onWaiting)
    a.addEventListener('canplay', handlers.onCanPlay)
    a.addEventListener('error', handlers.onError)
    this.listenersWired = true
  }

  destroy() {
    this.stop()
    if (this.ctx) {
      this.ctx.close().catch(() => {})
      this.ctx = null
    }
    this.analyser = null
    this.audio = null
    this.listenersWired = false
  }
}
