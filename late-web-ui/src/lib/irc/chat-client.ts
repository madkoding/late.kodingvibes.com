import type { ChannelState, ChatMessage, UserInfo, ChannelInfo, ChannelMember, AttachmentMeta, ChannelCategory } from '../chat/domain/types'
import { debugLog, debugError } from '../session-debug'

type StateHandler = (state: Partial<{
  connected: boolean
  user: UserInfo | null
  channels: Map<number, ChannelState>
  currentChannel: number | null
  tokenInvalid: boolean
}>) => void

type MessageHandler = (msg: ChatMessage) => void

export interface TypingPayload {
  channel_id: number
  user_id: number
  display_name: string
  typing: boolean
}

export interface BuzzPayload {
  from_user_id: number
  from_display_name: string
  channel_id: number
  timestamp: number
}

export interface MemberMutedPayload {
  channel_id: number
  user_id: number
  muted: boolean
}

/**
 * ChatClient connects to the chat-bridge backend (WebSocket + REST)
 * instead of a raw IRC server. It speaks the same channel/message
 * shape the UI already expects.
 */
export class ChatClient {
  private ws: WebSocket | null = null
  private sessionId: string
  private baseUrl: string
  private currentChannelId: number | null = null
  private user: UserInfo | null = null
  public channels: Map<number, ChannelState> = new Map()
  // Map of user_id -> current display_name. Updated every time
  // we see a message or load history from that user, and also
  // when the local user changes their own nick. Used by the UI
  // to render the *current* nick on past messages after a rename.
  public nickByUserId: Map<number, string> = new Map()
  private connected = false
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private maxReconnectDelay = 30000
  // Cap on how long we keep retrying before giving up and treating
  // the session as dead. Without this, a server that always rejects
  // the WS (e.g. expired token) would loop forever in the background.
  private maxReconnectWindowMs = 5 * 60 * 1000
  private firstDisconnectAt: number | null = null
  private tokenInvalid = false
  private authFatalHandlers: Set<() => void> = new Set()
  private stateHandlers: Set<StateHandler> = new Set()
  private messageHandlers: Set<MessageHandler> = new Set()
  private typingHandlers: Set<(data: TypingPayload) => void> = new Set()
  private buzzHandlers: Set<(data: BuzzPayload) => void> = new Set()
  private memberMutedHandlers: Set<(data: MemberMutedPayload) => void> = new Set()
  public voiceHandlers: Set<(type: string, data: any) => void> = new Set()

  private _wsHandlers: ReadonlyMap<string, (msg: any) => void>

  constructor(sessionId: string) {
    this.sessionId = sessionId
    this.baseUrl = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    this._wsHandlers = this._buildWsHandlers()
  }

  onState(handler: StateHandler): () => void {
    this.stateHandlers.add(handler)
    return () => this.stateHandlers.delete(handler)
  }

  /**
   * Fired once when the client gives up reconnecting because the
   * session is dead (expired token, server-side kick, etc.). The
   * page is expected to clear localStorage and redirect to SSO.
   * Only fires while the client is alive; safe to register before
   * start().
   */
  onAuthFatal(handler: () => void): () => void {
    this.authFatalHandlers.add(handler)
    return () => this.authFatalHandlers.delete(handler)
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  onTyping(handler: (data: TypingPayload) => void): () => void {
    this.typingHandlers.add(handler)
    return () => this.typingHandlers.delete(handler)
  }

  onBuzz(handler: (data: BuzzPayload) => void): () => void {
    this.buzzHandlers.add(handler)
    return () => this.buzzHandlers.delete(handler)
  }

  onMemberMuted(handler: (data: MemberMutedPayload) => void): () => void {
    this.memberMutedHandlers.add(handler)
    return () => this.memberMutedHandlers.delete(handler)
  }

  onVoiceMessage(handler: (type: string, data: any) => void): () => void {
    this.voiceHandlers.add(handler)
    return () => this.voiceHandlers.delete(handler)
  }

  sendRaw(msg: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const m = msg as any
      if (typeof m?.type === 'string' && m.type.startsWith('voice.') && (window as any).__voiceDebug?.enabled) {
        // eslint-disable-next-line no-console
        console.log(`[voice ${new Date().toISOString().slice(11, 23)}] ws.send`, m.type, m)
      }
      this.ws.send(JSON.stringify(msg))
    }
  }

  /** Tell the server the local user is typing in `channelId`.
   *  Throttling is the caller's job (one signal per 3s is plenty). */
  sendTyping(channelId: number, typing: boolean): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify({ type: 'typing', channel_id: channelId, typing }))
  }

  private emitState(state: Partial<{
    connected: boolean
    user: UserInfo | null
    channels: Map<number, ChannelState>
    currentChannel: number | null
    tokenInvalid: boolean
  }>) {
    this.stateHandlers.forEach(h => h(state))
  }

  private fireAuthFatal() {
    if (this.tokenInvalid) return
    this.tokenInvalid = true
    debugError('client', 'fireAuthFatal()', { previouslyInvalid: false })
    this.emitState({ connected: false, tokenInvalid: true })
    for (const h of this.authFatalHandlers) {
      try { h() } catch { /* ignore */ }
    }
  }

  private emitMessage(msg: ChatMessage) {
    this.messageHandlers.forEach(h => h(msg))
  }

  private emitBuzz(data: BuzzPayload) {
    this.buzzHandlers.forEach(h => h(data))
  }

  private emitMemberMuted(data: MemberMutedPayload) {
    this.memberMutedHandlers.forEach(h => h(data))
  }

  private trackName(id: number, name?: string | null) {
    if (name) this.nickByUserId.set(id, name)
  }

  private updateMessageInChannel(channelId: number, messageId: number, patch: Partial<ChatMessage>) {
    const ch = this.channels.get(channelId)
    if (!ch) return
    const idx = ch.messages.findIndex(x => x.id === messageId)
    if (idx < 0) return
    const newMessages = ch.messages.slice()
    newMessages[idx] = { ...newMessages[idx], ...patch }
    this.channels.set(ch.id, { ...ch, messages: newMessages })
    this.emitState({ channels: new Map(this.channels) })
  }

  private _buildWsHandlers(): ReadonlyMap<string, (msg: any) => void> {
    return new Map([
      ['message', (msg) => { this.handleIncoming(msg.data as ChatMessage) }],
      ['message_og', (msg) => {
        const data = msg.data as { id: number; og_data: unknown }
        for (const ch of this.channels.values()) {
          const m = ch.messages.find(x => x.id === data.id)
          if (m) {
            m.og_data = (data.og_data as ChatMessage['og_data']) ?? null
            this.emitState({ channels: new Map(this.channels) })
            break
          }
        }
      }],
      ['reaction', (msg) => {
        const data = msg.data as { message_id: number; channel_id: number; reactions: ChatMessage['reactions']; user_id: number; display_name: string }
        this.trackName(data.user_id, data.display_name)
        this.updateMessageInChannel(data.channel_id, data.message_id, { reactions: data.reactions ?? [] })
      }],
      ['hide', (msg) => {
        const data = msg.data as { message_id: number; channel_id: number }
        this.updateMessageInChannel(data.channel_id, data.message_id, { hidden: true })
      }],
      ['delete', (msg) => {
        const data = msg.data as { message_id: number; channel_id: number }
        this.updateMessageInChannel(data.channel_id, data.message_id, { content: '[eliminado]', hidden: true })
      }],
      ['typing', (msg) => {
        const data = msg.data as TypingPayload
        this.trackName(data.user_id, data.display_name)
        for (const h of this.typingHandlers) h(data)
      }],
      ['buzz', (msg) => {
        debugLog('buzz', 'WS buzz event received', msg.data)
        this.emitBuzz(msg.data as BuzzPayload)
      }],
      ['member_muted', (msg) => {
        this.emitMemberMuted(msg.data as MemberMutedPayload)
        const data = msg.data as MemberMutedPayload
        for (const ch of this.channels.values()) {
          if (!ch.members) continue
          const idx = ch.members.findIndex(m => m.id === data.user_id)
          if (idx >= 0) {
            const newMembers = ch.members.slice()
            newMembers[idx] = { ...newMembers[idx], muted: data.muted }
            this.channels.set(ch.id, { ...ch, members: newMembers })
            this.emitState({ channels: new Map(this.channels) })
            break
          }
        }
      }],
      ['member_role_changed', (msg) => {
        const data = msg.data as { channel_id: number; user_id: number; role: string | null }
        for (const ch of this.channels.values()) {
          if (!ch.members) continue
          const idx = ch.members.findIndex(m => m.id === data.user_id)
          if (idx >= 0) {
            const newMembers = ch.members.slice()
            newMembers[idx] = { ...newMembers[idx], role: data.role }
            this.channels.set(ch.id, { ...ch, members: newMembers })
            if (data.user_id === this.user?.id && ch.id === data.channel_id) {
              ch.myRole = data.role
            }
            this.emitState({ channels: new Map(this.channels) })
            break
          }
        }
      }],
      ['voice_note', (msg) => {
        const data = msg.data as { id: string; user_id: number; channel_id: number; display_name?: string; created_at: number }
        const ch = this.channels.get(data.channel_id)
        if (!ch) return
        const virtId = -Math.abs(Date.now()) - Math.floor(Math.random() * 10000)
        const chatMsg: ChatMessage = {
          id: virtId, channel_id: data.channel_id, user_id: data.user_id,
          display_name: data.display_name || `User ${data.user_id}`, email: '',
          content: `__late_voicenote__:${data.id}`, created_at: data.created_at,
        }
        if (ch.messages.some(m => m.id === virtId)) return
        ch.messages.push(chatMsg)
        if (data.channel_id !== this.currentChannelId) ch.unread = (ch.unread ?? 0) + 1
        this.emitState({ channels: new Map(this.channels) })
        this.emitMessage(chatMsg)
      }],
      ['voice.participants', (msg) => {
        const data = msg.data as { room_id: string; count: number; participants?: { user_id: number; display_name: string }[] }
        const ch = this.channels.get(Number(data.room_id))
        if (ch) {
          ch.voiceParticipants = data.count
          if (Array.isArray(data.participants)) {
            ch.voiceParticipantNames = data.participants.map(p => ({ userId: p.user_id, displayName: p.display_name }))
          }
          this.emitState({ channels: new Map(this.channels) })
        }
      }],
      ['presence.online', (msg) => {
        const data = msg.data as { user_id: number; online: boolean }
        this.applyPresence(data.user_id, data.online)
      }],
    ])
  }

  /** Update the local `active` flag and per-channel activeCount for
   *  `userId` across every channel we already know about. If the user
   *  is not in any loaded channel's member list, this is a no-op. */
  private applyPresence(userId: number, online: boolean) {
    let changed = false
    for (const ch of this.channels.values()) {
      if (!ch.members) continue
      const idx = ch.members.findIndex(m => m.id === userId)
      if (idx >= 0 && ch.members[idx].active !== online) {
        const newMembers = ch.members.slice()
        newMembers[idx] = { ...newMembers[idx], active: online }
        ch.members = newMembers
        const cur = ch.activeCount ?? 0
        ch.activeCount = Math.max(0, cur + (online ? 1 : -1))
        changed = true
      }
    }
    if (changed) this.emitState({ channels: new Map(this.channels) })
  }

  async start(): Promise<void> {
    try {
      debugLog('client', 'start() begin', { sessionIdLen: this.sessionId.length })
      // Load profile
      const me = await this.api<UserInfo>('GET', '/api/chat/me')
      this.user = me
      debugLog('client', 'GET /api/chat/me ok', { id: me.id, email: me.email, display_name: me.display_name })
      this.emitState({ user: this.user })
      // Load channels
      const chans = await this.api<ChannelInfo[]>('GET', '/api/chat/channels')
      debugLog('client', 'GET /api/chat/channels ok', { count: chans.length })
      this.channels = new Map()
      for (const c of chans) {
        this.channels.set(c.id, {
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
        })
      }
      this.emitState({ channels: new Map(this.channels) })
      // Heartbeat every 2 min so last_seen stays fresh
      this.startHeartbeat()
      // Connect WS
      this.connectWs()
    } catch (err) {
      debugError('client', 'start() failed', { message: (err as Error)?.message })
      this.emitState({ connected: false })
      // Any 401 from REST means the session is dead. Mark it
      // fatal so the page redirects to SSO instead of looping
      // through the WS reconnect path with a useless token.
      if (err instanceof Error && /401|unauthor/i.test(err.message)) {
        debugError('client', 'start() saw 401/unauthor, firing authFatal')
        this.fireAuthFatal()
      }
      throw err
    }
  }

  public async api<T>(method: string, path: string, body?: any): Promise<T> {
    const res = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.sessionId}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}))
      debugError('api', `${method} ${path} -> ${res.status}`, { detail: detail?.detail || detail })
      throw new Error(detail.detail || `${method} ${path} failed: ${res.status}`)
    }
    return res.json()
  }

  private connectWs() {
    const host = window.location.host
    const url = `${this.baseUrl}//${host}/api/chat/ws?token=${this.sessionId}`
    debugLog('ws', 'connecting', { url: url.replace(this.sessionId, '<token>') })
    this.ws = new WebSocket(url)
    this.ws.onopen = () => {
      this.connected = true
      this.reconnectAttempts = 0
      this.firstDisconnectAt = null
      this.emitState({ connected: true })
      debugLog('ws', 'onopen')
      this.pingInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 30000)
    }
    this.ws.onclose = (ev) => {
      this.connected = false
      this.emitState({ connected: false })
      debugLog('ws', 'onclose', { code: ev.code, reason: ev.reason, wasClean: ev.wasClean })
      if (this.pingInterval) {
        clearInterval(this.pingInterval)
        this.pingInterval = null
      }
      // Codes that mean the server (or our token) is the problem,
      // not a flaky network. Any of these → the session is dead,
      // stop reconnecting and let the page redirect to SSO.
      //   1008 policy violation (auth/token rejection)
      //   4xxx    application-defined auth failures
      //   4001/4401 are common conventions for "unauthorized"
      const fatalCode = ev.code === 1008 || (ev.code >= 4000 && ev.code < 5000)
      if (fatalCode) {
        debugError('ws', 'fatal close code, fireAuthFatal', { code: ev.code })
        this.fireAuthFatal()
        return
      }
      this.scheduleReconnect()
    }
    this.ws.onerror = () => {
      // onclose will fire after this
    }
    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type?.startsWith('voice.') && (window as any).__voiceDebug?.enabled) {
          // eslint-disable-next-line no-console
          console.log(`[voice ${new Date().toISOString().slice(11, 23)}] ws.recv`, msg.type, msg.data)
        }
        // Track names from voice events so the participant tiles can
        // resolve the real display name without waiting for a chat
        // message from that user.
        let nickMapChanged = false
        if (msg.type === 'voice.peer_joined' && msg.data?.user_id) {
          this.trackName(msg.data.user_id, msg.data.display_name)
          nickMapChanged = true
        } else if (msg.type === 'voice.peers' && Array.isArray(msg.data?.peers)) {
          for (const p of msg.data.peers) {
            if (p && typeof p === 'object' && p.user_id) {
              this.trackName(p.user_id, p.display_name)
              nickMapChanged = true
            }
          }
        } else if (msg.type === 'voice.offer' && msg.data?.from_display_name) {
          this.trackName(msg.data.from, msg.data.from_display_name)
          nickMapChanged = true
        } else if (msg.type === 'voice.answer' && msg.data?.from_display_name) {
          this.trackName(msg.data.from, msg.data.from_display_name)
          nickMapChanged = true
        }
        // The nickByUserId map is a separate ref; the React tree only
        // re-syncs it on a state emit. Force one so voice-driven name
        // changes propagate to the participant tiles.
        if (nickMapChanged) this.emitState({ channels: new Map(this.channels) })
        const handler = this._wsHandlers.get(msg.type)
        if (handler) handler(msg)
        else if (msg.type?.startsWith('voice.')) {
          for (const h of this.voiceHandlers) h(msg.type.slice(6), msg.data)
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    if (this.firstDisconnectAt === null) {
      this.firstDisconnectAt = Date.now()
    } else if (Date.now() - this.firstDisconnectAt >= this.maxReconnectWindowMs) {
      // We've been trying for too long. Treat the session as
      // dead and let the page redirect to SSO instead of spinning
      // forever in the background.
      debugError('ws', 'reconnect window exceeded, fireAuthFatal', { attempts: this.reconnectAttempts })
      this.fireAuthFatal()
      return
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay)
    this.reconnectAttempts++
    debugLog('ws', 'scheduleReconnect', { attempt: this.reconnectAttempts, delayMs: delay })
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connectWs()
    }, delay)
  }

  private handleIncoming(data: ChatMessage) {
    const ch = this.channels.get(data.channel_id)
    if (!ch) return
    // Dedup by id
    if (ch.messages.some(m => m.id === data.id)) return
    // Clone the ChannelState so React detects the new messages
    // reference. Without this, the push mutates the array in
    // place and the consumer gets the same reference — no re-render.
    const newMessages = ch.messages.slice()
    newMessages.push(data)
    this.channels.set(data.channel_id, { ...ch, messages: newMessages })
    // Track the sender's current display_name. If they later
    // rename, PATCH /api/chat/me will refresh this entry too.
    this.trackName(data.user_id, data.display_name)
    // Bump the unread badge for non-current channels. The
    // current channel's mark-read is handled by a fire-and-
    // forget POST below.
    if (data.channel_id !== this.currentChannelId) {
      ch.unread = (ch.unread ?? 0) + 1
    } else {
      // Tell the server we've seen this message so the next
      // /channels call returns unread=0 for the active channel.
      void this.markRead(data.channel_id)
    }
    // Always emit the new channels map so the React tree sees
    // the new message. Without this, the local sender (and any
    // recipient viewing the current channel) never gets the
    // new message in their UI: the previous code only emitted
    // state when the channel was *not* the current one, so the
    // sender's own messages disappeared from the chat until a
    // full reload.
    this.emitState({ channels: new Map(this.channels) })
    this.emitMessage(data)
  }

  async loadHistory(channelId: number, before?: number, limit = 20): Promise<ChatMessage[]> {
    const path = before
      ? `/api/chat/channels/${channelId}/messages?before=${before}&limit=${limit}`
      : `/api/chat/channels/${channelId}/messages?limit=${limit}`
    const msgs = await this.api<ChatMessage[]>('GET', path)
    const ch = this.channels.get(channelId)
    if (ch) {
      const existing = new Set(ch.messages.map(m => m.id))
      const toAdd: ChatMessage[] = []
      for (const m of msgs) {
        if (!existing.has(m.id)) {
          toAdd.push(m)
        }
        this.trackName(m.user_id, m.display_name)
      }
      if (toAdd.length > 0) {
        const merged = ch.messages.concat(toAdd).sort((a, b) => a.id - b.id)
        this.channels.set(channelId, { ...ch, messages: merged })
        this.emitState({ channels: new Map(this.channels) })
      }
    }
    return msgs
  }

  async updateMe(patch: { display_name?: string; name?: string }): Promise<UserInfo> {
    const me = await this.api<UserInfo>('PATCH', '/api/chat/me', patch)
    this.user = me
    this.trackName(me.id, me.display_name)
    this.emitState({ user: this.user })
    return me
  }

  async loadMembers(channelId: number): Promise<ChannelMember[]> {
    try {
      const members = await this.api<ChannelMember[]>(
        'GET', `/api/chat/channels/${channelId}/members`,
      )
      const ch = this.channels.get(channelId)
      if (ch) {
        ch.members = members
        for (const m of members) {
          this.trackName(m.id, m.display_name)
        }
        this.emitState({ channels: new Map(this.channels) })
      }
      return members
    } catch {
      return []
    }
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) return
    this.heartbeatInterval = setInterval(() => {
      this.api('POST', '/api/chat/heartbeat').catch(() => {})
    }, 2 * 60 * 1000)
  }

  async sendMessage(channelId: number, content: string, options?: { is_action?: boolean; reply_to?: number }): Promise<void> {
    const ch = this.channels.get(channelId)
    const tempId = -Date.now() - Math.floor(Math.random() * 10000)
    if (ch && this.user) {
      // Look up the message being replied to so the optimistic
      // bubble can render the reply preview immediately (the
      // server only fills reply_to_* on the real response, and
      // waiting for the round-trip left the cite blank).
      const replyTarget = options?.reply_to
        ? ch.messages.find(m => m.id === options.reply_to)
        : null
      const optimistic: ChatMessage = {
        id: tempId,
        channel_id: channelId,
        user_id: this.user.id,
        display_name: this.user.display_name,
        email: this.user.email,
        content,
        is_action: options?.is_action,
        reply_to: options?.reply_to,
        reply_to_content: replyTarget?.content ?? null,
        reply_to_author: replyTarget?.display_name ?? null,
        reply_to_user_id: replyTarget?.user_id ?? null,
        created_at: Math.floor(Date.now() / 1000),
        reactions: [],
      }
      const newMessages = ch.messages.slice()
      newMessages.push(optimistic)
      this.channels.set(channelId, { ...ch, messages: newMessages })
      this.emitState({ channels: new Map(this.channels) })
    }
    const data = await this.api<ChatMessage>('POST', `/api/chat/channels/${channelId}/messages`, {
      content,
      is_action: options?.is_action,
      reply_to: options?.reply_to,
    })
    // Replace the optimistic message with the real one
    if (ch) {
      const cur = this.channels.get(channelId)
      if (cur) {
        const replaced = cur.messages.map(m => m.id === tempId ? data : m)
        this.channels.set(channelId, { ...cur, messages: replaced })
        this.emitState({ channels: new Map(this.channels) })
      }
    }
  }  /**
   * Toggle a reaction emoji on a message. The server adds it
   * if missing or removes it if present; the WS broadcast then
   * updates every client with the new full set, so this
   * method's return value is informational only.
   */
  async toggleReaction(messageId: number, emoji: string): Promise<void> {
    if (!this.user) return
    const userId = this.user.id
    // Optimistic flip: find the message, toggle this user's
    // reaction in the local store, emit state. The WS broadcast
    // (which includes the sender — the reaction route does NOT
    // exclude) will reconcile to the server's authoritative list
    // a moment later. Without this, the chip doesn't appear
    // until the round-trip completes and the UI feels laggy.
    for (const ch of this.channels.values()) {
      const idx = ch.messages.findIndex(m => m.id === messageId)
      if (idx >= 0) {
        const current = ch.messages[idx]
        const existing = (current.reactions ?? []).find(
          r => r.user_id === userId && r.emoji === emoji
        )
        const next = existing
          ? (current.reactions ?? []).filter(r => !(r.user_id === userId && r.emoji === emoji))
          : [...(current.reactions ?? []), { user_id: userId, emoji, created_at: Math.floor(Date.now() / 1000) }]
        const newMessages = ch.messages.slice()
        newMessages[idx] = { ...current, reactions: next }
        this.channels.set(ch.id, { ...ch, messages: newMessages })
        this.emitState({ channels: new Map(this.channels) })
        break
      }
    }
    await this.api('POST', `/api/chat/messages/${messageId}/reactions`, { emoji })
  }

  /** Send a buzz (attention signal) to a user in a channel. */
  async buzz(channelId: number, targetUserId: number): Promise<void> {
    debugLog('buzz', 'chat-client.buzz POST', { channelId, targetUserId })
    try {
      await this.api('POST', '/api/chat/buzz', { channel_id: channelId, target_user_id: targetUserId })
      debugLog('buzz', 'chat-client.buzz POST ok', { channelId, targetUserId })
    } catch (err) {
      debugError('buzz', 'chat-client.buzz POST failed', { channelId, targetUserId, message: (err as Error).message })
      throw err
    }
  }

  /** Forward a message to another channel (or the same channel).
   *  The server creates a new message with `forwarded_from` attribution.
   *  The WS broadcast delivers it to the destination channel. */
  async forwardMessage(messageId: number, targetChannelId: number): Promise<ChatMessage> {
    const data = await this.api<ChatMessage>('POST', `/api/chat/messages/${messageId}/forward`, {
      target_channel_id: targetChannelId,
    })
    // Add to local store so the sender sees it immediately (the WS
    // broadcast excludes the sender).
    this.handleIncoming(data)
    return data
  }

  /** Upload a file attachment to a channel. Returns the attachment metadata. */
  async uploadAttachment(channelId: number, file: File): Promise<AttachmentMeta> {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`/api/chat/channels/${channelId}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.sessionId}` },
      body: formData,
    })
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}))
      throw new Error(detail.detail || `Upload failed: ${res.status}`)
    }
    return res.json()
  }

  async joinChannel(name: string): Promise<ChannelInfo> {
    // First try to find existing
    const existing = Array.from(this.channels.values()).find(c => c.name === name)
    if (existing) return {
      id: existing.id,
      name: existing.name,
      description: existing.description,
      is_public: existing.isPublic,
      channel_type: existing.channelType,
      category_id: existing.categoryId,
      position: existing.position,
      member_count: existing.memberCount,
      active_count: existing.activeCount ?? 0,
      voice_participants: existing.voiceParticipants ?? 0,
      unread: existing.unread,
      my_role: existing.myRole ?? null,
      last_message: null,
    }
    const created = await this.api<ChannelInfo>('POST', '/api/chat/channels', { name, is_public: true })
    // Auto-join
    await this.api('POST', `/api/chat/channels/${created.id}/join`)
    const ch: ChannelState = {
      id: created.id,
      name: created.name,
      description: created.description,
      isPublic: created.is_public,
      channelType: created.channel_type,
      categoryId: created.category_id ?? null,
      position: created.position ?? 0,
      memberCount: 1,
      activeCount: 1,
      voiceParticipants: 0,
      unread: 0,
      myRole: 'admin',
      messages: [],
      joined: true,
    }
    this.channels.set(created.id, ch)
    this.emitState({ channels: new Map(this.channels) })
    return created
  }

  async setCurrentChannel(channelId: number | null) {
    this.currentChannelId = channelId
    this.emitState({ currentChannel: channelId })
    if (channelId !== null) {
      const ch = this.channels.get(channelId)
      if (ch && ch.messages.length === 0) {
        await this.loadHistory(channelId)
        ch.unread = 0
      }
      // Mark as read up to the last message
      if (ch && ch.messages.length > 0) {
        const lastId = ch.messages[ch.messages.length - 1].id
        try {
          await this.api('POST', `/api/chat/channels/${channelId}/read?message_id=${lastId}`)
        } catch {}
        ch.unread = 0
        this.emitState({ channels: new Map(this.channels) })
      }
    }
  }

  async markRead(channelId: number) {
    const ch = this.channels.get(channelId)
    if (!ch || ch.messages.length === 0) return
    const lastId = ch.messages[ch.messages.length - 1].id
    try {
      await this.api('POST', `/api/chat/channels/${channelId}/read?message_id=${lastId}`)
    } catch {}
    ch.unread = 0
    this.emitState({ channels: new Map(this.channels) })
  }

  getCurrentChannel(): number | null {
    return this.currentChannelId
  }

  getUser(): UserInfo | null {
    return this.user
  }

  isConnected(): boolean {
    return this.connected
  }

  // Re-fetch the channel list (unread + member counts). Merges
  // into the existing local channel map so message history is
  // preserved.
  async refreshChannels(): Promise<void> {
    const chans = await this.api<ChannelInfo[]>('GET', '/api/chat/channels')
    for (const c of chans) {
      const existing = this.channels.get(c.id)
      if (existing) {
        existing.memberCount = c.member_count
        existing.activeCount = c.active_count
        existing.channelType = c.channel_type
        existing.categoryId = c.category_id ?? null
        existing.position = c.position ?? 0
        existing.voiceParticipants = c.voice_participants ?? 0
        if (c.id !== this.currentChannelId) {
          existing.unread = c.unread
        }
      } else {
          const ch: ChannelState = {
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
        this.channels.set(c.id, ch)
      }
    }
    this.emitState({ channels: new Map(this.channels) })
  }

  // Force a re-fetch of the current channel's history. Drops
  // the in-memory message list and re-loads from the server so
  // the chat reflects everything that was sent while the user
  // was away.
  async reloadCurrentChannelHistory(): Promise<void> {
    const id = this.currentChannelId
    if (id === null) return
    const ch = this.channels.get(id)
    if (!ch) return
    ch.messages = []
    await this.loadHistory(id)
    ch.unread = 0
    this.emitState({ channels: new Map(this.channels) })
  }

  // --- Categories ---

  async listCategories(): Promise<ChannelCategory[]> {
    return this.api<ChannelCategory[]>('GET', '/api/chat/categories')
  }

  async createCategory(name: string): Promise<ChannelCategory> {
    return this.api<ChannelCategory>('POST', '/api/chat/categories', { name })
  }

  async updateCategory(id: number, patch: { name?: string; is_collapsed?: boolean }): Promise<ChannelCategory> {
    return this.api<ChannelCategory>('PATCH', `/api/chat/categories/${id}`, patch)
  }

  async deleteCategory(id: number): Promise<void> {
    await this.api('DELETE', `/api/chat/categories/${id}`)
  }

  async updateChannel(id: number, patch: { category_id?: number | null; position?: number }): Promise<void> {
    await this.api('PATCH', `/api/chat/channels/${id}`, patch)
  }

  // --- End categories ---

  disconnect() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
    this.connected = false
    this.firstDisconnectAt = null
    this.emitState({ connected: false })
  }
}
