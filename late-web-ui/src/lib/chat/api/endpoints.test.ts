import { describe, it, expect, beforeEach } from 'vitest'
import { ENDPOINTS } from './endpoints'

describe('ENDPOINTS', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { protocol: 'https:', host: 'late.kodingvibes.com' },
      writable: true,
    })
  })

  it('ws returns wss:// when protocol is https', () => {
    const url = ENDPOINTS.ws()
    expect(url).toBe('wss://late.kodingvibes.com/api/chat/ws')
  })

  it('ws returns ws:// when protocol is http', () => {
    Object.defineProperty(window, 'location', {
      value: { protocol: 'http:', host: 'late.kodingvibes.com' },
      writable: true,
    })
    const url = ENDPOINTS.ws()
    expect(url).toBe('ws://late.kodingvibes.com/api/chat/ws')
  })

  it('me returns /api/chat/me', () => {
    expect(ENDPOINTS.me).toBe('/api/chat/me')
  })

  it('channelMessages returns correct path', () => {
    expect(ENDPOINTS.channelMessages(42)).toBe('/api/chat/channels/42/messages')
  })

  it('channelMembers returns correct path', () => {
    expect(ENDPOINTS.channelMembers(7)).toBe('/api/chat/channels/7/members')
  })
})
