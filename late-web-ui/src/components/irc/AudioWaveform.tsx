import { useEffect, useRef, useState, useCallback } from 'react'
import { Play, Pause, Music } from 'lucide-react'

interface AudioWaveformProps {
  src: string
  filename?: string
}

/**
 * Custom audio message player. Aesthetic: round play/pause button on
 * the left, waveform visualization on the right that doubles as a
 * seekable timeline. No counters, no volume, no native controls.
 * The waveform is generated from the audio buffer once on mount.
 */
export default function AudioWaveform({ src, filename }: AudioWaveformProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const peaksRef = useRef<number[] | null>(null)
  const progressRef = useRef(0)
  const drawRef = useRef<(() => void) | null>(null)

  const [peaks, setPeaks] = useState<number[] | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [hasError, setHasError] = useState(false)
  // Total length of the audio, in seconds. Set from the
  // <audio> element once metadata is available. We keep it as
  // state (not a ref) so the time label re-renders when it
  // first lands.
  const [duration, setDuration] = useState(0)
  // Computed once when the audio is decoded. Applied via a
  // MediaElementAudioSource → Gain → destination graph so the
  // playback level is normalized regardless of how quiet or
  // loud the original recording is.
  const [volumeGain, setVolumeGain] = useState(1)
  const volumeGainRef = useRef(1)
  volumeGainRef.current = volumeGain
  const audioCtxRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)

  // Decode the audio file once to extract peak amplitudes for the
  // waveform display. Web Audio API requires a user gesture on
  // some browsers, so we use a dedicated AudioContext.
  //
  // Also extracts the overall peak so we can normalize the
  // playback volume — voice notes recorded on a quiet mic come
  // out barely audible, and a loud one clips. We compute the
  // gain once from the peak and apply it via a Web Audio graph
  // (source → gain → destination) so every playback is at a
  // consistent level without touching the file on disk.
  useEffect(() => {
    let cancelled = false
    let ctx: AudioContext | null = null

    const load = async () => {
      try {
        const res = await fetch(src)
        if (!res.ok) throw new Error('fetch failed')
        const buf = await res.arrayBuffer()
        const Ctor = window.AudioContext || (window as any).webkitAudioContext
        if (!Ctor) throw new Error('no AudioContext')
        ctx = new Ctor()
        const audio = await ctx.decodeAudioData(buf)
        if (cancelled) return
        const ch = audio.getChannelData(0)
        // ~80 bars across the timeline — gives a nice clean look
        // without being too dense.
        const bars = 80
        const blockSize = Math.max(1, Math.floor(ch.length / bars))
        const out: number[] = new Array(bars)
        let overallPeak = 0
        for (let i = 0; i < bars; i++) {
          let max = 0
          const start = i * blockSize
          const end = Math.min(ch.length, start + blockSize)
          for (let j = start; j < end; j++) {
            const v = Math.abs(ch[j])
            if (v > max) max = v
            if (v > overallPeak) overallPeak = v
          }
          out[i] = max
        }
        peaksRef.current = out
        setPeaks(out)
        // Normalize to -1 dBFS (≈0.89). Cap gain at 12x so a
        // near-silent recording doesn't blast at full volume
        // (likely just noise) and to avoid amplifying hiss.
        const TARGET = 0.89
        const MAX_GAIN = 12
        if (overallPeak > 0.001) {
          const gain = Math.min(MAX_GAIN, TARGET / overallPeak)
          setVolumeGain(gain)
        } else {
          setVolumeGain(1)
        }
        setIsLoading(false)
      } catch {
        if (!cancelled) {
          setHasError(true)
          setIsLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
      if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {})
    }
  }, [src])

  // Draw the waveform on the canvas. Re-draws on resize so the
  // resolution stays sharp on retina screens. The draw function
  // is exposed via drawRef so the rAF loop can call it on every
  // frame while playing, without re-binding the effect.
  useEffect(() => {
    if (!peaks || !canvasRef.current || !containerRef.current) return
    const canvas = canvasRef.current
    const container = containerRef.current
    const c2d = canvas.getContext('2d')
    if (!c2d) return

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = container.clientWidth
      const h = container.clientHeight
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr)
        canvas.height = Math.floor(h * dpr)
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
      }
      c2d.setTransform(dpr, 0, 0, dpr, 0, 0)
      c2d.clearRect(0, 0, w, h)

      const n = peaks.length
      const barW = w / n
      const mid = h / 2
      const playedFrac = progressRef.current

      for (let i = 0; i < n; i++) {
        const v = peaks[i]
        // Scale the visual by the same gain we apply at
        // playback so a quiet recording that gets boosted
        // to -1 dBFS also looks full in the waveform —
        // otherwise the bars would stay tiny even though
        // the audio plays loud.
        const visual = Math.min(1, v * volumeGainRef.current)
        const barH = Math.max(2, visual * (h - 4))
        const x = i * barW
        const y = mid - barH / 2
        const frac = i / n
        c2d.fillStyle = frac < playedFrac
          ? 'rgb(165, 180, 254)'
          : 'rgba(148, 163, 184, 0.45)'
        c2d.fillRect(x + 0.5, y, Math.max(1, barW - 1.5), barH)
      }
    }

    drawRef.current = draw
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(container)
    return () => {
      drawRef.current = null
      ro.disconnect()
    }
  }, [peaks])

  // Smooth progress tracking: rAF ticks at the display refresh rate
  // so the bar advances fluidly instead of jumping in 250ms increments
  // like the native `timeupdate` event. Also drives the cursor dot
  // position via the same progress value.
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => { setIsPlaying(false); setProgress(1); progressRef.current = 1 }
    const onError = () => { setHasError(true); setIsLoading(false) }
    const onLoadedMetadata = () => {
      if (a.duration && !isNaN(a.duration)) setDuration(a.duration)
    }
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    a.addEventListener('ended', onEnded)
    a.addEventListener('error', onError)
    a.addEventListener('loadedmetadata', onLoadedMetadata)

    let raf = 0
    const tick = () => {
      if (a.duration && !isNaN(a.duration)) {
        const p = a.currentTime / a.duration
        progressRef.current = p
        setProgress(p)
        drawRef.current?.()
      }
      raf = requestAnimationFrame(tick)
    }
    const onPlaying = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(tick)
    }
    const onStopped = () => {
      cancelAnimationFrame(raf)
      // one last draw to settle the playhead at the final position
      if (a.duration && !isNaN(a.duration)) {
        const p = a.currentTime / a.duration
        progressRef.current = p
        setProgress(p)
        drawRef.current?.()
      }
    }
    a.addEventListener('play', onPlaying)
    a.addEventListener('pause', onStopped)
    a.addEventListener('ended', onStopped)
    a.addEventListener('seeked', onStopped)

    return () => {
      cancelAnimationFrame(raf)
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
      a.removeEventListener('ended', onEnded)
      a.removeEventListener('error', onError)
      a.removeEventListener('play', onPlaying)
      a.removeEventListener('pause', onStopped)
      a.removeEventListener('ended', onStopped)
      a.removeEventListener('seeked', onStopped)
      a.removeEventListener('loadedmetadata', onLoadedMetadata)
    }
  }, [])

  // Wire the <audio> element into a Web Audio graph with the
  // computed gain so playback is normalized. Must run after
  // the element exists (it's rendered unconditionally below)
  // and after volumeGain is set. We use a one-shot effect
  // gated on volumeGain becoming non-default (1) so the
  // graph isn't recreated on every re-render.
  useEffect(() => {
    const a = audioRef.current
    if (!a || volumeGain === 1) return
    if (sourceRef.current) return // already wired
    try {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext
      if (!Ctor) return
      const audioCtx = new Ctor()
      const source = audioCtx.createMediaElementSource(a)
      const gain = audioCtx.createGain()
      gain.gain.value = volumeGain
      source.connect(gain)
      gain.connect(audioCtx.destination)
      audioCtxRef.current = audioCtx
      sourceRef.current = source
      gainNodeRef.current = gain
    } catch {
      // Some browsers throw if createMediaElementSource is
      // called twice on the same element. Fall back to the
      // element's native volume (no normalization).
    }
  }, [volumeGain])

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volumeGain
    }
  }, [volumeGain])

  // Close the playback AudioContext on unmount. Important
  // because each <audio> element can only have one
  // MediaElementAudioSource — if we leaked the context, the
  // next mount of this component would fail to wire the graph.
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {})
      }
      audioCtxRef.current = null
      sourceRef.current = null
      gainNodeRef.current = null
    }
  }, [])

  const togglePlay = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    // Resume the AudioContext on user gesture so the
    // normalization graph actually processes sound. Browsers
    // require this — without it, the <audio> element plays
    // through its default output and bypasses the GainNode.
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {})
    }
    if (a.paused) {
      a.play().catch(() => setHasError(true))
    } else {
      a.pause()
    }
  }, [])

  // Click anywhere on the waveform to seek.
  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current
    const container = containerRef.current
    if (!a || !container || !a.duration || isNaN(a.duration)) return
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const frac = Math.max(0, Math.min(1, x / rect.width))
    a.currentTime = frac * a.duration
    setProgress(frac)
  }, [])

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/40 min-w-[260px] shadow-soft transition-all hover:border-indigo-500/30 hover:shadow-card">
      <button
        type="button"
        onClick={togglePlay}
        disabled={isLoading || hasError}
        className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:from-slate-700 disabled:to-slate-700 text-white flex items-center justify-center flex-shrink-0 transition-all shadow-md hover:shadow-lg hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100"
        aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
      >
        {isLoading ? (
          <span className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
        ) : hasError ? (
          <Music className="w-4 h-4 opacity-60" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 translate-x-[1px]" />
        )}
      </button>

      <div
        ref={containerRef}
        onClick={seek}
        className="relative flex-1 h-10 cursor-pointer select-none"
        role="slider"
        aria-label="Línea de tiempo del audio"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        {isLoading && (
          <div className="absolute inset-0 flex items-center">
            <div className="w-full h-px bg-slate-700" />
          </div>
        )}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500">
            {filename || 'audio'}
          </div>
        )}
        {isPlaying && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-lg pointer-events-none"
            style={{ left: `calc(${progress * 100}% - 5px)` }}
          />
        )}
      </div>
      {duration > 0 && (
        <span className="text-[10px] text-slate-500 tabular-nums flex-shrink-0">
          {fmtTime(duration)}
        </span>
      )}

      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
    </div>
  )
}

function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
