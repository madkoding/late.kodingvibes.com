export const API_BASE = '/api/chat'

export const ENDPOINTS = {
  me: `${API_BASE}/me`,
  heartbeat: `${API_BASE}/heartbeat`,
  channels: `${API_BASE}/channels`,
  categories: `${API_BASE}/categories`,
  buzz: `${API_BASE}/buzz`,
  ws: () => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}${API_BASE}/ws`
  },
  channelMessages: (id: number) => `${API_BASE}/channels/${id}/messages`,
  channelMembers: (id: number) => `${API_BASE}/channels/${id}/members`,
  channelJoin: (id: number) => `${API_BASE}/channels/${id}/join`,
  channelRead: (id: number) => `${API_BASE}/channels/${id}/read`,
  messageReactions: (id: number) => `${API_BASE}/messages/${id}/reactions`,
  messageForward: (id: number) => `${API_BASE}/messages/${id}/forward`,
  channelAttachments: (id: number) => `${API_BASE}/channels/${id}/attachments`,
}
