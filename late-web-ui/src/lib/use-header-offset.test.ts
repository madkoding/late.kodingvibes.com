import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHeaderOffset } from './use-header-offset'

describe('useHeaderOffset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.documentElement.style.setProperty('--vh', '0.8')
  })

  it('returns headerHeight and vh', () => {
    const { result } = renderHook(() => useHeaderOffset())
    expect(result.current).toHaveProperty('headerHeight')
    expect(result.current).toHaveProperty('vh')
  })

  it('measures on mount', () => {
    const { result } = renderHook(() => useHeaderOffset())
    expect(typeof result.current.headerHeight).toBe('number')
    expect(typeof result.current.vh).toBe('number')
  })
})
