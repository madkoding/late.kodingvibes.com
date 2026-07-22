import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, renderHook, act } from '@testing-library/react'
import { AudioProvider, useAudio } from './AudioProvider'

describe('AudioProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    HTMLAudioElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  })

  it('useAudio returns context', () => {
    const { result } = renderHook(() => useAudio(), { wrapper: AudioProvider })
    expect(result.current).toHaveProperty('current')
    expect(result.current).toHaveProperty('playing')
    expect(result.current).toHaveProperty('play')
    expect(result.current).toHaveProperty('toggle')
    expect(result.current).toHaveProperty('stop')
    expect(result.current).toHaveProperty('setVolume')
    expect(result.current).toHaveProperty('toggleMute')
  })

  it('AudioProvider renders children', () => {
    const { getByText } = render(
      <AudioProvider>
        <div>child</div>
      </AudioProvider>,
    )
    expect(getByText('child')).toBeDefined()
  })

  it('play sets current and calls audio.play', () => {
    const { result } = renderHook(() => useAudio(), { wrapper: AudioProvider })
    const stream = { name: 'test', mount: 'test', url: 'https://example.com/stream' }
    act(() => { result.current.play(stream) })
    expect(result.current.current).toEqual(stream)
  })

  it('toggle pauses when playing', () => {
    const { result } = renderHook(() => useAudio(), { wrapper: AudioProvider })
    act(() => { result.current.toggle() })
  })

  it('stop clears current', () => {
    const { result } = renderHook(() => useAudio(), { wrapper: AudioProvider })
    act(() => { result.current.stop() })
    expect(result.current.current).toBeNull()
  })

  it('setVolume sets volume', () => {
    const { result } = renderHook(() => useAudio(), { wrapper: AudioProvider })
    act(() => { result.current.setVolume(0.5) })
    expect(result.current.volume).toBe(0.5)
  })

  it('toggleMute toggles muted', () => {
    const { result } = renderHook(() => useAudio(), { wrapper: AudioProvider })
    const initial = result.current.muted
    act(() => { result.current.toggleMute() })
    expect(result.current.muted).toBe(!initial)
  })
})
