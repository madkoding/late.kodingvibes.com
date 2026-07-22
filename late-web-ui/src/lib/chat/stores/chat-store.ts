import { create } from 'zustand'
import type { ChannelState, ChatMessage, ChannelMember, ChannelCategory } from '../domain/types'

interface ChatState {
  channels: Map<number, ChannelState>
  currentChannelId: number | null
  categories: ChannelCategory[]
  setChannels: (channels: Map<number, ChannelState>) => void
  setCurrentChannel: (id: number | null) => void
  setCategories: (categories: ChannelCategory[]) => void
  updateChannel: (id: number, patch: Partial<ChannelState>) => void
  addChannel: (ch: ChannelState) => void
  addMessages: (channelId: number, messages: ChatMessage[]) => void
  setMembers: (channelId: number, members: ChannelMember[]) => void
  updateMessage: (channelId: number, messageId: number, patch: Partial<ChatMessage>) => void
  setUnread: (channelId: number, unread: number) => void
  setVoiceParticipants: (channelId: number, count: number) => void
}

export const useChatStore = create<ChatState>((set) => ({
  channels: new Map(),
  currentChannelId: null,
  categories: [],

  setChannels: (channels) => set({ channels }),

  setCurrentChannel: (id) => set({ currentChannelId: id }),

  setCategories: (categories) => set({ categories }),

  updateChannel: (id, patch) => set((s) => {
    const ch = s.channels.get(id)
    if (!ch) return s
    const next = new Map(s.channels)
    next.set(id, { ...ch, ...patch })
    return { channels: next }
  }),

  addChannel: (ch) => set((s) => {
    const next = new Map(s.channels)
    next.set(ch.id, ch)
    return { channels: next }
  }),

  addMessages: (channelId, messages) => set((s) => {
    const ch = s.channels.get(channelId)
    if (!ch) return s
    const existingIds = new Set(ch.messages.map(m => m.id))
    const newMsgs = messages.filter(m => !existingIds.has(m.id))
    if (newMsgs.length === 0) return s
    const merged = [...ch.messages, ...newMsgs].sort((a, b) => a.id - b.id)
    const next = new Map(s.channels)
    next.set(channelId, { ...ch, messages: merged })
    return { channels: next }
  }),

  setMembers: (channelId, members) => set((s) => {
    const ch = s.channels.get(channelId)
    if (!ch) return s
    const next = new Map(s.channels)
    next.set(channelId, { ...ch, members })
    return { channels: next }
  }),

  updateMessage: (channelId, messageId, patch) => set((s) => {
    const ch = s.channels.get(channelId)
    if (!ch) return s
    const idx = ch.messages.findIndex(m => m.id === messageId)
    if (idx < 0) return s
    const newMessages = ch.messages.slice()
    newMessages[idx] = { ...newMessages[idx], ...patch }
    const next = new Map(s.channels)
    next.set(channelId, { ...ch, messages: newMessages })
    return { channels: next }
  }),

  setUnread: (channelId, unread) => set((s) => {
    const ch = s.channels.get(channelId)
    if (!ch) return s
    const next = new Map(s.channels)
    next.set(channelId, { ...ch, unread })
    return { channels: next }
  }),

  setVoiceParticipants: (channelId, count) => set((s) => {
    const ch = s.channels.get(channelId)
    if (!ch) return s
    const next = new Map(s.channels)
    next.set(channelId, { ...ch, voiceParticipants: count })
    return { channels: next }
  }),
}))
