import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from './chat-store'
import type { ChatMessage } from '../domain/types'

function resetStore() {
  useChatStore.setState({ channels: new Map(), currentChannelId: null, categories: [] })
}

beforeEach(() => resetStore())

describe('useChatStore', () => {
  it('starts empty', () => {
    const s = useChatStore.getState()
    expect(s.channels.size).toBe(0)
    expect(s.currentChannelId).toBeNull()
    expect(s.categories).toEqual([])
  })

  it('setChannels replaces channels', () => {
    const ch = { id: 1, name: 'general', messages: [] } as any
    const map = new Map([[1, ch]])
    useChatStore.getState().setChannels(map)
    expect(useChatStore.getState().channels.size).toBe(1)
  })

  it('setCurrentChannel updates current channel', () => {
    useChatStore.getState().setCurrentChannel(5)
    expect(useChatStore.getState().currentChannelId).toBe(5)
  })

  it('setCategories replaces categories', () => {
    useChatStore.getState().setCategories([{ id: 1, name: 'General', position: 0, is_collapsed: false, created_at: 0, server_id: 's1' }])
    expect(useChatStore.getState().categories).toHaveLength(1)
  })

  it('updateChannel patches existing channel', () => {
    const ch = { id: 1, name: 'general', unread: 0, messages: [] } as any
    useChatStore.getState().setChannels(new Map([[1, ch]]))
    useChatStore.getState().updateChannel(1, { unread: 5 })
    expect(useChatStore.getState().channels.get(1)?.unread).toBe(5)
  })

  it('updateChannel does nothing for missing channel', () => {
    useChatStore.getState().updateChannel(99, { unread: 5 })
    expect(useChatStore.getState().channels.size).toBe(0)
  })

  it('addChannel adds a new channel', () => {
    const ch = { id: 2, name: 'random', messages: [] } as any
    useChatStore.getState().addChannel(ch)
    expect(useChatStore.getState().channels.get(2)?.name).toBe('random')
  })

  it('addMessages deduplicates by id', () => {
    const ch = { id: 1, name: 'general', messages: [{ id: 1, content: 'a' }] } as any
    useChatStore.getState().setChannels(new Map([[1, ch]]))
    useChatStore.getState().addMessages(1, [
      { id: 1, content: 'a' } as ChatMessage,
      { id: 2, content: 'b' } as ChatMessage,
    ])
    expect(useChatStore.getState().channels.get(1)?.messages).toHaveLength(2)
  })

  it('addMessages does nothing for missing channel', () => {
    useChatStore.getState().addMessages(99, [{ id: 1 } as ChatMessage])
    expect(useChatStore.getState().channels.size).toBe(0)
  })

  it('setMembers updates channel members', () => {
    const ch = { id: 1, name: 'general', messages: [] } as any
    useChatStore.getState().setChannels(new Map([[1, ch]]))
    useChatStore.getState().setMembers(1, [{ id: 1, display_name: 'Alice', email: 'a@b', active: true, role: null, muted: false }])
    expect(useChatStore.getState().channels.get(1)?.members).toHaveLength(1)
  })

  it('updateMessage patches a message', () => {
    const ch = { id: 1, name: 'general', messages: [{ id: 10, content: 'old' } as ChatMessage] } as any
    useChatStore.getState().setChannels(new Map([[1, ch]]))
    useChatStore.getState().updateMessage(1, 10, { content: 'new', hidden: true })
    expect(useChatStore.getState().channels.get(1)?.messages[0].content).toBe('new')
    expect(useChatStore.getState().channels.get(1)?.messages[0].hidden).toBe(true)
  })

  it('setUnread updates unread count', () => {
    const ch = { id: 1, name: 'general', unread: 0, messages: [] } as any
    useChatStore.getState().setChannels(new Map([[1, ch]]))
    useChatStore.getState().setUnread(1, 3)
    expect(useChatStore.getState().channels.get(1)?.unread).toBe(3)
  })

  it('setVoiceParticipants updates count', () => {
    const ch = { id: 1, name: 'general', voiceParticipants: 0, messages: [] } as any
    useChatStore.getState().setChannels(new Map([[1, ch]]))
    useChatStore.getState().setVoiceParticipants(1, 2)
    expect(useChatStore.getState().channels.get(1)?.voiceParticipants).toBe(2)
  })
})
