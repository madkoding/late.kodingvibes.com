import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AudioEngine } from './audio-engine'

describe('AudioEngine', () => {
  let engine: AudioEngine

  beforeEach(() => {
    vi.clearAllMocks()
    engine = new AudioEngine()
    HTMLAudioElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  })

  it('getAudioElement creates Audio', () => {
    const el = engine.getAudioElement()
    expect(el).toBeInstanceOf(HTMLAudioElement)
    expect(el.preload).toBe('none')
  })

  it('getAudioElement returns same instance', () => {
    const el1 = engine.getAudioElement()
    const el2 = engine.getAudioElement()
    expect(el1).toBe(el2)
  })

  it('play sets src and calls play', () => {
    const el = engine.getAudioElement()
    const spy = vi.spyOn(el, 'play').mockResolvedValue(undefined)
    engine.play('https://example.com/stream')
    expect(el.src).toContain('example.com/stream')
    expect(spy).toHaveBeenCalled()
  })

  it('pause calls audio.pause', () => {
    const el = engine.getAudioElement()
    const spy = vi.spyOn(el, 'pause')
    engine.pause()
    expect(spy).toHaveBeenCalled()
  })

  it('stop clears src', () => {
    const el = engine.getAudioElement()
    el.src = 'https://example.com/stream'
    engine.stop()
    expect(el.src).not.toContain('example.com')
  })

  it('playing returns false when no audio', () => {
    expect(engine.playing).toBe(false)
  })

  it('wireListeners registers events', () => {
    const handlers = { onPlaying: vi.fn(), onPause: vi.fn(), onWaiting: vi.fn(), onCanPlay: vi.fn(), onError: vi.fn() }
    engine.wireListeners(handlers)
    const el = engine.getAudioElement()
    el.dispatchEvent(new Event('playing'))
    expect(handlers.onPlaying).toHaveBeenCalled()
  })

  it('wireListeners only wires once', () => {
    const handlers = { onPlaying: vi.fn(), onPause: vi.fn(), onWaiting: vi.fn(), onCanPlay: vi.fn(), onError: vi.fn() }
    engine.wireListeners(handlers)
    engine.wireListeners(handlers)
    const el = engine.getAudioElement()
    el.dispatchEvent(new Event('playing'))
    expect(handlers.onPlaying).toHaveBeenCalledTimes(1)
  })

  it('destroy cleans up', () => {
    engine.getAudioElement()
    engine.destroy()
    expect(engine.getAudioElement()).not.toBeNull()
  })

  it('setVolume clamps 0-1', () => {
    const el = engine.getAudioElement()
    engine.setVolume(0.5)
    expect(el.volume).toBe(0.5)
    engine.setVolume(2)
    expect(el.volume).toBe(1)
    engine.setVolume(-1)
    expect(el.volume).toBe(0)
  })
})
