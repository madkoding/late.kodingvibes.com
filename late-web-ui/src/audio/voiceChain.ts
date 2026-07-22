import { PRESETS, mapAmountToRatio, type PresetName } from './presets'

export interface VoiceChain {
  ctx: AudioContext
  processedStream: MediaStream
  destroy: () => void
}

export function createVoiceChain(
  inputStream: MediaStream,
  presetName: PresetName = 'radio-am',
  amount = 50,
): VoiceChain {
  const ctx = new AudioContext()
  const source = ctx.createMediaStreamSource(inputStream)
  const preset = PRESETS[presetName]
  const ratio = mapAmountToRatio(amount)

  const highpass = ctx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = preset.highpassFreq || 0
  highpass.Q.value = 0.7

  const gateAnalyser = ctx.createAnalyser()
  gateAnalyser.fftSize = 128

  const gateGain = ctx.createGain()
  gateGain.gain.value = 1

  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = preset.threshold
  compressor.ratio.value = ratio
  compressor.attack.value = preset.attack
  compressor.release.value = preset.release
  compressor.knee.value = preset.knee

  const peaking = ctx.createBiquadFilter()
  peaking.type = 'peaking'
  peaking.frequency.value = preset.peakingFreq || 0
  peaking.gain.value = preset.peakingGain || 0
  peaking.Q.value = preset.peakingQ || 1

  let waveShaper: WaveShaperNode | null = null
  if (preset.waveShaperCurve) {
    waveShaper = ctx.createWaveShaper()
    // @ts-ignore
    waveShaper.curve = preset.waveShaperCurve
  }

  const makeup = ctx.createGain()
  makeup.gain.value = preset.makeupGain || 0

  const destination = ctx.createMediaStreamDestination()

  source.connect(highpass)
  highpass.connect(gateAnalyser)
  gateAnalyser.connect(gateGain)
  gateGain.connect(compressor)
  compressor.connect(peaking)
  if (waveShaper) {
    peaking.connect(waveShaper)
    waveShaper.connect(makeup)
  } else {
    peaking.connect(makeup)
  }
  makeup.connect(destination)

  let gateTimer: ReturnType<typeof setInterval> | null = null
  if (presetName !== 'off' && preset.gateThreshold > -Infinity) {
    gateTimer = setInterval(() => {
      const data = new Uint8Array(gateAnalyser.frequencyBinCount)
      gateAnalyser.getByteTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sum += v * v
      }
      const rmsDb = 20 * Math.log10(Math.sqrt(sum / data.length) || 1e-10)
      const target = rmsDb > preset.gateThreshold ? 1 : 0
      gateGain.gain.setTargetAtTime(target, ctx.currentTime, 0.05)
    }, 50)
  }

  const chain: VoiceChain = {
    ctx,
    get processedStream() { return destination.stream },
    destroy() {
      if (gateTimer) clearInterval(gateTimer)
      ctx.close()
    },

  }

  return chain
}
