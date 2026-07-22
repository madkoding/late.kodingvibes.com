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
    function draw(now: number) {
      const c = canvasRef.current
      if (!c || !analyser) {
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
      const N = analyser.frequencyBinCount
      const data = new Uint8Array(N)
      analyser.getByteFrequencyData(data)
      const bars = Math.max(16, Math.floor(w / 4))
      const visibleBars = bars - 4
      const startBin = 2
      const endBin = Math.floor(N * 0.7)
      const barW = c.width / visibleBars
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
        const raw = Math.min(1, (avg / 255) * trebleBoost)
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
