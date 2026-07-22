export type WsMessageHandler = (msg: { type: string; data: unknown }) => void

export interface ReconnectingWsOptions {
  url: string
  onMessage: WsMessageHandler
  onConnected?: () => void
  onDisconnected?: () => void
  onAuthFatal?: () => void
  pingIntervalMs?: number
  maxReconnectWindowMs?: number
  maxReconnectDelay?: number
}

export class ReconnectingWs {
  private ws: WebSocket | null = null
  private connected = false
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private firstDisconnectAt: number | null = null
  private destroyed = false
  private opts: ReconnectingWsOptions

  constructor(opts: ReconnectingWsOptions) {
    this.opts = {
      pingIntervalMs: 30000,
      maxReconnectWindowMs: 5 * 60 * 1000,
      maxReconnectDelay: 30000,
      ...opts,
    }
    this.connect()
  }

  send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  private connect() {
    if (this.destroyed) return
    this.ws = new WebSocket(this.opts.url)
    this.ws.onopen = () => {
      this.connected = true
      this.reconnectAttempts = 0
      this.firstDisconnectAt = null
      this.opts.onConnected?.()
      this.startPing()
    }
    this.ws.onclose = (ev) => {
      this.connected = false
      this.stopPing()
      this.opts.onDisconnected?.()
      const fatalCode = ev.code === 1008 || (ev.code >= 4000 && ev.code < 5000)
      if (fatalCode) {
        this.opts.onAuthFatal?.()
        return
      }
      this.scheduleReconnect()
    }
    this.ws.onerror = () => {}
    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        this.opts.onMessage(msg)
      } catch { /* ignore parse errors */ }
    }
  }

  private startPing() {
    this.stopPing()
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' })
    }, this.opts.pingIntervalMs)
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.destroyed) return
    if (this.firstDisconnectAt === null) {
      this.firstDisconnectAt = Date.now()
    } else if (Date.now() - this.firstDisconnectAt >= (this.opts.maxReconnectWindowMs ?? 300000)) {
      this.opts.onAuthFatal?.()
      return
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.opts.maxReconnectDelay ?? 30000)
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  isConnected(): boolean {
    return this.connected
  }

  destroy() {
    this.destroyed = true
    this.stopPing()
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
  }
}
