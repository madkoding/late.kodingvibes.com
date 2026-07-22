import { describe, it, expect, beforeEach } from 'vitest'
import { loadVolume, saveVolume, loadMuted, saveMuted, loadCurrent, saveCurrent, loadWasPlaying, savePlaying } from './persistence'

describe('audio persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loadVolume returns default 0.7', () => {
    expect(loadVolume()).toBe(0.7)
  })

  it('saveVolume and loadVolume round-trip', () => {
    saveVolume(0.3)
    expect(loadVolume()).toBe(0.3)
  })

  it('loadMuted returns false by default', () => {
    expect(loadMuted()).toBe(false)
  })

  it('saveMuted and loadMuted round-trip', () => {
    saveMuted(true)
    expect(loadMuted()).toBe(true)
    saveMuted(false)
    expect(loadMuted()).toBe(false)
  })

  it('loadCurrent returns null by default', () => {
    expect(loadCurrent()).toBeNull()
  })

  it('saveCurrent and loadCurrent round-trip', () => {
    const data = { name: 'test', mount: 'test', url: 'http://example.com' }
    saveCurrent(data)
    expect(loadCurrent()).toEqual(data)
  })

  it('saveCurrent null removes key', () => {
    saveCurrent({ name: 'test', mount: 'test', url: 'http://example.com' })
    saveCurrent(null)
    expect(loadCurrent()).toBeNull()
  })

  it('loadWasPlaying returns false by default', () => {
    expect(loadWasPlaying()).toBe(false)
  })

  it('savePlaying and loadWasPlaying round-trip', () => {
    savePlaying(true)
    expect(loadWasPlaying()).toBe(true)
    savePlaying(false)
    expect(loadWasPlaying()).toBe(false)
  })
})
