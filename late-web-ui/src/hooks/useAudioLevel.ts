import { useEffect, useRef, useState } from 'react'

export function useAudioLevel(stream: MediaStream | null): number {
  const [level, setLevel] = useState(0)
  const ctxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!stream) {
      setLevel(0)
      return
    }
    const ctx = new AudioContext()
    ctxRef.current = ctx
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 64
    source.connect(analyser)

    const data = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / data.length)
      setLevel(rms)
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(rafRef.current)
      ctx.close()
    }
  }, [stream])

  return level
}
