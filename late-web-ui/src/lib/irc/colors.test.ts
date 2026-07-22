import { describe, it, expect } from 'vitest'
import { getNickColor } from './colors'

describe('getNickColor', () => {
  it('returns a string starting with #', () => {
    expect(getNickColor('alice')).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('is deterministic — same nick returns same color', () => {
    const c1 = getNickColor('bob')
    const c2 = getNickColor('bob')
    expect(c1).toBe(c2)
  })

  it('different nicks can return different colors', () => {
    const colors = new Set(Array.from({ length: 50 }, (_, i) => getNickColor(`user${i}`)))
    expect(colors.size).toBeGreaterThan(1)
  })

  it('empty string returns a color', () => {
    expect(getNickColor('')).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('long nicks still produce valid colors', () => {
    expect(getNickColor('a'.repeat(100))).toMatch(/^#[0-9a-f]{6}$/)
  })
})
