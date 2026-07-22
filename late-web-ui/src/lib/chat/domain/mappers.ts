import type { ChannelInfo, ChannelState, ChatMessage } from './types'

export function toChannelState(c: ChannelInfo): ChannelState {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    isPublic: c.is_public,
    channelType: c.channel_type,
    categoryId: c.category_id ?? null,
    position: c.position ?? 0,
    memberCount: c.member_count,
    activeCount: c.active_count,
    voiceParticipants: c.voice_participants ?? 0,
    unread: c.unread,
    myRole: c.my_role ?? null,
    messages: [],
    joined: true,
  }
}

export function mergeChannelState(existing: ChannelState, fresh: ChannelInfo): ChannelState {
  return {
    ...existing,
    memberCount: fresh.member_count,
    activeCount: fresh.active_count,
    channelType: fresh.channel_type,
    categoryId: fresh.category_id ?? null,
    position: fresh.position ?? 0,
    voiceParticipants: fresh.voice_participants ?? 0,
    unread: fresh.id !== undefined ? fresh.unread : existing.unread,
  }
}

export function dedupMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const existingIds = new Set(existing.map(m => m.id))
  const merged = [...existing]
  for (const m of incoming) {
    if (!existingIds.has(m.id)) {
      merged.push(m)
      existingIds.add(m.id)
    }
  }
  merged.sort((a, b) => a.id - b.id)
  return merged
}
