import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAudioLevel } from './useAudioLevel'

describe('useAudioLevel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 0 when stream is null', () => {
    const { result } = renderHook(() => useAudioLevel(null))
    expect(result.current).toBe(0)
  })

  it('returns rms level when stream is provided', () => {
    const stream = new MediaStream()
    const { result } = renderHook(() => useAudioLevel(stream))
    expect(typeof result.current).toBe('number')
  })

  it('cleanup cancels raf', () => {
    const stream = new MediaStream()
    const spy = vi.spyOn(globalThis, 'cancelAnimationFrame')
    const { unmount } = renderHook(() => useAudioLevel(stream))
    unmount()
    expect(spy).toHaveBeenCalled()
  })
})
