import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from './session-store'

beforeEach(() => {
  useSessionStore.setState({ user: null, connected: false, tokenInvalid: false })
})

describe('useSessionStore', () => {
  it('starts with defaults', () => {
    const s = useSessionStore.getState()
    expect(s.user).toBeNull()
    expect(s.connected).toBe(false)
    expect(s.tokenInvalid).toBe(false)
  })

  it('setUser updates user', () => {
    useSessionStore.getState().setUser({ id: 1, email: 'a@b', name: 'Alice', display_name: 'Alice' })
    expect(useSessionStore.getState().user?.display_name).toBe('Alice')
  })

  it('setConnected updates connected', () => {
    useSessionStore.getState().setConnected(true)
    expect(useSessionStore.getState().connected).toBe(true)
  })

  it('setTokenInvalid updates tokenInvalid', () => {
    useSessionStore.getState().setTokenInvalid(true)
    expect(useSessionStore.getState().tokenInvalid).toBe(true)
  })
})
