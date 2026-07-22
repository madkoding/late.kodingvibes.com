import { describe, it, expect } from 'vitest'
import { toChannelState, mergeChannelState, dedupMessages } from './mappers'
import type { ChannelInfo, ChatMessage } from './types'

const makeChannelInfo = (overrides: Partial<ChannelInfo> = {}): ChannelInfo => ({
  id: 1,
  name: 'general',
  description: 'General chat',
  is_public: true,
  channel_type: 'text',
  category_id: null,
  position: 0,
  member_count: 5,
  active_count: 3,
  voice_participants: 0,
  unread: 2,
  my_role: 'member',
  last_message: null,
  ...overrides,
})

describe('toChannelState', () => {
  it('maps ChannelInfo to ChannelState', () => {
    const info = makeChannelInfo()
    const state = toChannelState(info)
    expect(state.id).toBe(1)
    expect(state.name).toBe('general')
    expect(state.isPublic).toBe(true)
    expect(state.messages).toEqual([])
    expect(state.joined).toBe(true)
  })

  it('handles null category_id', () => {
    const state = toChannelState(makeChannelInfo({ category_id: null }))
    expect(state.categoryId).toBeNull()
  })

  it('handles undefined channel_type', () => {
    const info = makeChannelInfo()
    delete (info as any).channel_type
    const state = toChannelState(info)
    expect(state.channelType).toBeUndefined()
  })
})

describe('mergeChannelState', () => {
  it('preserves existing messages', () => {
    const existing = toChannelState(makeChannelInfo())
    existing.messages = [{ id: 1, channel_id: 1, user_id: 1, display_name: 'a', email: 'a@b', content: 'hi', created_at: 100 } as ChatMessage]
    const fresh = makeChannelInfo({ member_count: 10, unread: 0 })
    const merged = mergeChannelState(existing, fresh)
    expect(merged.memberCount).toBe(10)
    expect(merged.messages).toHaveLength(1)
  })
})

describe('dedupMessages', () => {
  it('merges without duplicates', () => {
    const existing = [{ id: 1, content: 'a' }, { id: 2, content: 'b' }] as ChatMessage[]
    const incoming = [{ id: 2, content: 'b' }, { id: 3, content: 'c' }] as ChatMessage[]
    const result = dedupMessages(existing, incoming)
    expect(result).toHaveLength(3)
    expect(result.map(m => m.id)).toEqual([1, 2, 3])
  })

  it('sorts by id', () => {
    const existing = [{ id: 3, content: 'c' }] as ChatMessage[]
    const incoming = [{ id: 1, content: 'a' }, { id: 2, content: 'b' }] as ChatMessage[]
    const result = dedupMessages(existing, incoming)
    expect(result.map(m => m.id)).toEqual([1, 2, 3])
  })
})
