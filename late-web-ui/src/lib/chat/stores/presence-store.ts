import { create } from 'zustand'

interface PresenceState {
  nickByUserId: Map<number, string>
  typingByChannel: Map<number, Map<number, number>>
  setNick: (userId: number, name: string) => void
  setNickMap: (map: Map<number, string>) => void
  setTyping: (channelId: number, userId: number, timestamp: number) => void
  pruneTyping: (channelId: number, maxAgeMs: number) => void
}

export const usePresenceStore = create<PresenceState>((set) => ({
  nickByUserId: new Map(),
  typingByChannel: new Map(),

  setNick: (userId, name) => set((s) => {
    const next = new Map(s.nickByUserId)
    next.set(userId, name)
    return { nickByUserId: next }
  }),

  setNickMap: (map) => set({ nickByUserId: map }),

  setTyping: (channelId, userId, timestamp) => set((s) => {
    const channelTyping = new Map(s.typingByChannel.get(channelId) || new Map())
    channelTyping.set(userId, timestamp)
    const next = new Map(s.typingByChannel)
    next.set(channelId, channelTyping)
    return { typingByChannel: next }
  }),

  pruneTyping: (channelId, maxAgeMs) => set((s) => {
    const channelTyping = s.typingByChannel.get(channelId)
    if (!channelTyping) return s
    const now = Date.now()
    const next = new Map<number, number>()
    let changed = false
    for (const [id, t] of channelTyping) {
      if (now - t < maxAgeMs) next.set(id, t)
      else changed = true
    }
    if (!changed) return s
    const nextChannels = new Map(s.typingByChannel)
    nextChannels.set(channelId, next)
    return { typingByChannel: nextChannels }
  }),
}))
