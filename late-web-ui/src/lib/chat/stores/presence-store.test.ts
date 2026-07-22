import { describe, it, expect, beforeEach } from 'vitest'
import { usePresenceStore } from './presence-store'

beforeEach(() => {
  usePresenceStore.setState({ nickByUserId: new Map(), typingByChannel: new Map() })
})

describe('usePresenceStore', () => {
  it('setNick stores a nick', () => {
    usePresenceStore.getState().setNick(1, 'Alice')
    expect(usePresenceStore.getState().nickByUserId.get(1)).toBe('Alice')
  })

  it('setNickMap replaces the map', () => {
    const map = new Map([[1, 'Alice'], [2, 'Bob']])
    usePresenceStore.getState().setNickMap(map)
    expect(usePresenceStore.getState().nickByUserId.size).toBe(2)
  })

  it('setTyping records a typing timestamp', () => {
    usePresenceStore.getState().setTyping(1, 42, 1000)
    const channelTyping = usePresenceStore.getState().typingByChannel.get(1)
    expect(channelTyping?.get(42)).toBe(1000)
  })

  it('pruneTyping removes old entries', () => {
    usePresenceStore.getState().setTyping(1, 42, Date.now() - 10000)
    usePresenceStore.getState().pruneTyping(1, 5000)
    const channelTyping = usePresenceStore.getState().typingByChannel.get(1)
    expect(channelTyping?.size).toBe(0)
  })

  it('pruneTyping keeps recent entries', () => {
    usePresenceStore.getState().setTyping(1, 42, Date.now())
    usePresenceStore.getState().pruneTyping(1, 10000)
    const channelTyping = usePresenceStore.getState().typingByChannel.get(1)
    expect(channelTyping?.size).toBe(1)
  })
})
