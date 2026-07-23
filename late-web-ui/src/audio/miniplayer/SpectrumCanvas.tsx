import { useEffect, useRef } from 'react'

interface SpectrumCanvasProps {
  analyser: AnalyserNode | null
  className?: string
  style?: React.CSSProperties
}

export function SpectrumCanvas({ analyser, className, style }: SpectrumCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    const FRAME_MS = 1000 / 12
    let last = 0
    let silentFrames = 0
    let fallback = false
    let smoothed: number[] | null = null

    // WebKit bug 125031: Safari's createMediaElementSource() does not feed
    // live audio data into an AnalyserNode for remote streams, so
    // getByteFrequencyData() returns all zeroes. After ~2s of silence we fall
    // back to a synthetic waveform so the miniplayer still feels alive.
    function draw(now: number) {
      const c = canvasRef.current
      if (!c) {
        animRef.current = requestAnimationFrame(draw)
        return
      }
      if (now - last < FRAME_MS) {
        animRef.current = requestAnimationFrame(draw)
        return
      }
      last = now

      const ctx2d = c.getContext('2d')
      if (!ctx2d) return

      const dpr = window.devicePixelRatio || 1
      const w = c.clientWidth
      const h = c.clientHeight
      if (c.width !== w * dpr) {
        c.width = w * dpr
        c.height = h * dpr
      }
      ctx2d.clearRect(0, 0, c.width, c.height)

      const bars = Math.max(16, Math.floor(w / 4))
      const visibleBars = bars - 4
      const barW = c.width / visibleBars

      let values: number[] = []

      if (analyser && !fallback) {
        const N = analyser.frequencyBinCount
        const data = new Uint8Array(N)
        analyser.getByteFrequencyData(data)
        const isSilent = data.every(v => v === 0)
        if (isSilent) silentFrames++
        else silentFrames = 0
        if (silentFrames > 24) fallback = true // ~2s at 12fps

        const startBin = 2
        const endBin = Math.floor(N * 0.7)
        const minLog = Math.log(startBin)
        const maxLog = Math.log(endBin)
        for (let i = 0; i < visibleBars; i++) {
          const t0 = i / visibleBars
          const t1 = (i + 1) / visibleBars
          const lo = Math.floor(Math.exp(minLog + (maxLog - minLog) * t0))
          const hi = Math.max(lo + 1, Math.floor(Math.exp(minLog + (maxLog - minLog) * t1)))
          let sum = 0
          const count = Math.min(hi, N) - lo
          for (let b = lo; b < Math.min(hi, N); b++) sum += data[b]
          const avg = count > 0 ? sum / count : 0
          const trebleBoost = 1 + (i / visibleBars) * 0.4
          values.push(Math.min(1, (avg / 255) * trebleBoost))
        }
      }

      if (!analyser || fallback) {
        // Synthetic waveform tuned to look like real frequency-domain audio:
        // pink-ish spectral distribution (more bass/mid energy), smooth 1D noise,
        // occasional beat transients, and per-bar attack/decay filtering.
        const t = now / 1000
        const beat = (Math.sin(t * 7.5) + Math.sin(t * 15.3) * 0.5 + 1) * 0.5
        const transient = Math.max(0, Math.sin(t * 3.7) * Math.sin(t * 11.1)) ** 3
        const loudness = 0.55 + 0.35 * Math.sin(t * 0.4) + 0.25 * transient

        // 1D smooth noise: mix a few octaves so it is organic, not random.
        function noise(x: number) {
          const a = Math.sin(x * 3.1 + t * 1.3) * 0.5 + 0.5
          const b = Math.sin(x * 7.7 - t * 0.9) * 0.5 + 0.5
          const c = Math.sin(x * 13.3 + t * 2.1) * 0.5 + 0.5
          return (a + b * 0.5 + c * 0.25) / 1.75
        }

        for (let i = 0; i < visibleBars; i++) {
          const x = i / visibleBars
          // Frequency mask: bass/mids dominate, highs roll off.
          const freqMask = Math.max(0.25, 1 - x * 0.85) * (1 + 0.4 * Math.sin(x * 4))
          // Smooth correlated noise plus a beat kick on the left bars.
          const kick = (1 - x) ** 3 * beat * 0.7
          const n = noise(x) * freqMask + kick + transient * 0.3
          const target = Math.max(0, Math.min(1, n * loudness * 1.4))
          values.push(target)
        }

        // Apply a tiny one-pole smoothing filter so the bars move like real
        // VU meters (fast attack, medium decay) rather than raw noise.
        if (!smoothed) smoothed = new Array(visibleBars).fill(0)
        for (let i = 0; i < visibleBars; i++) {
          const target = values[i]
          const attack = target > smoothed[i] ? 0.85 : 0.35
          smoothed[i] += (target - smoothed[i]) * attack
          values[i] = smoothed[i]
        }
      } else {
        smoothed = null
      }

      for (let i = 0; i < visibleBars; i++) {
        const raw = values[i]
        const barH = Math.max(2, raw * c.height)
        const x = i * barW
        const y = c.height - barH
        const hue = 230 + (i / visibleBars) * 50
        ctx2d.fillStyle = `hsl(${hue}, 80%, 60%)`
        ctx2d.fillRect(x + 1, y, Math.max(1, barW - 2), barH)
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [analyser])

  return <canvas ref={canvasRef} className={className} style={style} />
}
