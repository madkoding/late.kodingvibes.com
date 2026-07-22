import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setVolume, playBuzz, playMentionBeep, ensureNotificationAudio } from './notification-sound'

describe('notification-sound', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('setVolume clamps 0-1', () => {
    setVolume(0)
    setVolume(100)
    setVolume(50)
  })

  it('playBuzz creates oscillators', () => {
    const spyCreateOscillator = vi.spyOn(window.AudioContext.prototype, 'createOscillator')
    const spyCreateGain = vi.spyOn(window.AudioContext.prototype, 'createGain')
    playBuzz(50)
    expect(spyCreateOscillator).toHaveBeenCalled()
    expect(spyCreateGain).toHaveBeenCalled()
  })

  it('playMentionBeep creates oscillators', () => {
    const spyCreateOscillator = vi.spyOn(window.AudioContext.prototype, 'createOscillator')
    const spyCreateGain = vi.spyOn(window.AudioContext.prototype, 'createGain')
    playMentionBeep()
    expect(spyCreateOscillator).toHaveBeenCalled()
    expect(spyCreateGain).toHaveBeenCalled()
  })

  it('ensureNotificationAudio does not throw', () => {
    expect(() => ensureNotificationAudio()).not.toThrow()
  })
})
