export interface UserInfo {
  id: number
  email: string
  name: string | null
  display_name: string
}

export interface ChannelUser {
  display_name: string
  email: string
}

export interface ChatMessage {
  id: number
  channel_id: number
  user_id: number
  display_name: string
  email: string
  content: string
  is_action?: boolean
  is_mass_mention?: boolean
  og_data?: OgData | null
  reactions?: Reaction[]
  created_at: number
  mentioned_user_ids?: number[]
  mentioned_emails?: string[]
  reply_to?: number | null
  reply_to_content?: string | null
  reply_to_author?: string | null
  reply_to_user_id?: number | null
  hidden?: boolean
  forwarded_from?: ForwardedFrom | null
}

export interface AttachmentMeta {
  id: string
  url: string
  kind: 'image' | 'audio' | 'video' | 'document' | 'file'
  filename: string
  mime: string
  size_bytes: number
  created_at: number
  expires_at: number
}

export interface Reaction {
  user_id: number
  emoji: string
  created_at: number
}

export interface ForwardedFrom {
  message_id: number
  channel_id: number
  channel_name: string
  user_id: number
  display_name: string
}

export interface OgData {
  url: string
  title?: string
  description?: string
  image?: string
  site_name?: string
}

export interface ChannelCategory {
  id: number
  server_id: string
  name: string
  position: number
  is_collapsed: boolean
  created_at: number
}

export interface ChannelInfo {
  id: number
  name: string
  description: string | null
  is_public: boolean
  channel_type?: string
  category_id: number | null
  position: number
  member_count: number
  active_count: number
  voice_participants?: number
  unread: number
  my_role: string | null
  last_message: {
    id: number
    content: string
    created_at: number
  } | null
}

export interface ChannelMember {
  id: number
  display_name: string
  email: string
  active: boolean
  role: string | null
  muted: boolean
}

export interface ChannelState {
  id: number
  name: string
  description: string | null
  isPublic: boolean
  channelType?: string
  categoryId: number | null
  position: number
  memberCount: number
  activeCount: number
  voiceParticipants?: number
  unread: number
  myRole: string | null
  messages: ChatMessage[]
  joined: boolean
  members?: ChannelMember[]
}

export interface SSOSession {
  session_id: string
  user: UserInfo
}
