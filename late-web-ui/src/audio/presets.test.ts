import { describe, it, expect } from 'vitest'
import { PRESETS, mapAmountToRatio } from './presets'

describe('presets', () => {
  it('PRESETS has radio-am and off', () => {
    expect(PRESETS['radio-am']).toBeDefined()
    expect(PRESETS['off']).toBeDefined()
  })

  it('radio-am has expected threshold', () => {
    expect(PRESETS['radio-am'].threshold).toBe(-30)
    expect(PRESETS['radio-am'].ratio).toBe(12)
  })

  it('off preset has ratio 1', () => {
    expect(PRESETS['off'].ratio).toBe(1)
    expect(PRESETS['off'].threshold).toBe(0)
  })

  it('mapAmountToRatio returns correct ratio', () => {
    expect(mapAmountToRatio(0)).toBe(1)
    expect(mapAmountToRatio(50)).toBe(10.5)
    expect(mapAmountToRatio(100)).toBe(20)
  })
})
