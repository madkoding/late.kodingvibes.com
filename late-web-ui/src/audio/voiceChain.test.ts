import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createVoiceChain } from './voiceChain'

describe('voiceChain', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createVoiceChain returns processedStream', () => {
    const stream = new MediaStream()
    const chain = createVoiceChain(stream, 'off', 0)
    expect(chain.processedStream).toBeDefined()
    expect(chain.processedStream).toBeInstanceOf(MediaStream)
    chain.destroy()
  })

  it('destroy closes context', () => {
    const stream = new MediaStream()
    const chain = createVoiceChain(stream, 'off', 0)
    const spy = vi.spyOn(chain.ctx, 'close')
    chain.destroy()
    expect(spy).toHaveBeenCalled()
  })

  it('gate timer ticks for radio-am preset', () => {
    vi.useFakeTimers()
    const stream = new MediaStream()
    const chain = createVoiceChain(stream, 'radio-am', 50)
    vi.advanceTimersByTime(100)
    chain.destroy()
    vi.useRealTimers()
  })
})
