export interface CompressorPreset {
  threshold: number
  ratio: number
  attack: number
  release: number
  knee: number
  makeupGain: number
  highpassFreq: number
  peakingFreq: number
  peakingGain: number
  peakingQ: number
  gateThreshold: number
  waveShaperCurve: Float32Array | null
}

export type PresetName = 'radio-am' | 'off'

export const PRESETS: Record<PresetName, CompressorPreset> = {
  'radio-am': {
    threshold: -30,
    ratio: 12,
    attack: 0.003,
    release: 0.25,
    knee: 0,
    makeupGain: 6,
    highpassFreq: 100,
    peakingFreq: 2500,
    peakingGain: 4,
    peakingQ: 1,
    gateThreshold: -45,
    waveShaperCurve: makeAMCurve(0.5),
  },
  'off': {
    threshold: 0,
    ratio: 1,
    attack: 0.001,
    release: 0.05,
    knee: 0,
    makeupGain: 0,
    highpassFreq: 0,
    peakingFreq: 0,
    peakingGain: 0,
    peakingQ: 1,
    gateThreshold: -Infinity,
    waveShaperCurve: null,
  },
}

function makeAMCurve(amount: number): Float32Array {
  const samples = 256
  const curve = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1
    const amt = amount / 100
    curve[i] = (1 + amt) * x - amt * x * x * x
  }
  return curve
}

export function mapAmountToRatio(amount: number): number {
  return 1 + (amount / 100) * 19
}
