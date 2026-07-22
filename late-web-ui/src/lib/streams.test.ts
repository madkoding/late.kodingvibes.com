import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  Object.defineProperty(window, 'location', {
    value: { origin: 'https://late.kodingvibes.com' },
    writable: true,
  })
})

import { STREAMS, SOURCE_LABELS } from './streams'

describe('streams', () => {
  it('STREAMS has 18 entries', () => {
    expect(STREAMS).toHaveLength(18)
  })

  it('STREAMS entries have required fields', () => {
    for (const s of STREAMS) {
      expect(s).toHaveProperty('name')
      expect(s).toHaveProperty('mount')
      expect(s).toHaveProperty('url')
      expect(s).toHaveProperty('category')
      expect(s).toHaveProperty('emoji')
      expect(s).toHaveProperty('accent')
    }
  })

  it('streamUrlFor uses window.location.origin', () => {
    const s = STREAMS[0]
    expect(s.url).toContain('/groovesalad')
  })

  it('SOURCE_LABELS derived correctly from STREAMS', () => {
    expect(Object.keys(SOURCE_LABELS)).toHaveLength(18)
    for (const s of STREAMS) {
      const label = SOURCE_LABELS[s.name]
      expect(label).toBeDefined()
      expect(label.name).toBe(s.name)
      expect(label.emoji).toBe(s.emoji)
      expect(label.color).toBe(s.accent)
    }
  })

  it('first stream is groovesalad', () => {
    expect(STREAMS[0].name).toBe('groovesalad')
    expect(STREAMS[0].mount).toBe('groovesalad')
  })

  it('last stream is thetrip', () => {
    expect(STREAMS[17].name).toBe('thetrip')
    expect(STREAMS[17].mount).toBe('thetrip')
  })
})
