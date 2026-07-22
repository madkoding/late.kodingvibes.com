import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ReconnectingWs } from './ws'

class MockWebSocket {
  static OPEN = 1
  readyState: number = MockWebSocket.OPEN
  send = vi.fn()
  close = vi.fn()
  onopen: (() => void) | null = null
  onclose: ((ev: { code: number }) => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  private handlers: Map<string, Set<(...args: any[]) => void>> = new Map()

  constructor(public url: string) {}

  addEventListener(event: string, handler: (...args: any[]) => void) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler)
  }

  removeEventListener(event: string, handler: (...args: any[]) => void) {
    this.handlers.get(event)?.delete(handler)
  }

  triggerOpen() {
    this.onopen?.()
    for (const h of this.handlers.get('open') || []) h()
  }

  triggerClose(code: number) {
    this.onclose?.({ code })
    for (const h of this.handlers.get('close') || []) h({ code })
  }

  triggerMessage(data: string) {
    this.onmessage?.({ data })
    for (const h of this.handlers.get('message') || []) h({ data })
  }
}

describe('ReconnectingWs', () => {
  let ws: ReconnectingWs
  const onMessage = vi.fn()
  const onConnected = vi.fn()
  const onDisconnected = vi.fn()
  const onAuthFatal = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket)
    onMessage.mockClear()
    onConnected.mockClear()
    onDisconnected.mockClear()
    onAuthFatal.mockClear()
  })

  afterEach(() => {
    ws?.destroy()
    vi.restoreAllMocks()
  })

  it('connects on construction', () => {
    ws = new ReconnectingWs({ url: 'ws://test', onMessage, onConnected, onDisconnected, onAuthFatal })
    const mock = (ws as any).ws as MockWebSocket
    mock.triggerOpen()
    expect(onConnected).toHaveBeenCalled()
    expect(ws.isConnected()).toBe(true)
  })

  it('calls onAuthFatal on code 1008', () => {
    ws = new ReconnectingWs({ url: 'ws://test', onMessage, onConnected, onDisconnected, onAuthFatal })
    const mock = (ws as any).ws as MockWebSocket
    mock.triggerOpen()
    mock.triggerClose(1008)
    expect(onAuthFatal).toHaveBeenCalled()
  })

  it('calls onAuthFatal on 4xxx codes', () => {
    ws = new ReconnectingWs({ url: 'ws://test', onMessage, onConnected, onDisconnected, onAuthFatal })
    const mock = (ws as any).ws as MockWebSocket
    mock.triggerOpen()
    mock.triggerClose(4401)
    expect(onAuthFatal).toHaveBeenCalled()
  })

  it('reconnects on non-fatal close', () => {
    vi.useFakeTimers()
    ws = new ReconnectingWs({ url: 'ws://test', onMessage, onConnected, onDisconnected, onAuthFatal })
    const mock = (ws as any).ws as MockWebSocket
    mock.triggerOpen()
    mock.triggerClose(1006)
    const initialWs = (ws as any).ws
    vi.advanceTimersByTime(2000)
    expect((ws as any).ws).not.toBe(initialWs)
    vi.useRealTimers()
  })

  it('fires auth fatal after max reconnect window', () => {
    vi.useFakeTimers()
    ws = new ReconnectingWs({ url: 'ws://test', onMessage, onConnected, onDisconnected, onAuthFatal, maxReconnectWindowMs: 10000 })
    const mock = (ws as any).ws as MockWebSocket
    mock.triggerOpen()
    mock.triggerClose(1006)
    // firstDisconnectAt is now set. The reconnect timer fires after ~1s.
    // The new WS is created. It auto-closes (simulating persistent failure).
    vi.advanceTimersByTime(2000)
    const mock2 = (ws as any).ws as MockWebSocket
    mock2.triggerClose(1006)
    // Advance past the window. The next reconnect attempt will check the window.
    vi.advanceTimersByTime(15000)
    const mock3 = (ws as any).ws as MockWebSocket
    mock3.triggerClose(1006)
    expect(onAuthFatal).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('send() queues data when connected', () => {
    ws = new ReconnectingWs({ url: 'ws://test', onMessage })
    const mock = (ws as any).ws as MockWebSocket
    mock.triggerOpen()
    ws.send({ type: 'ping' })
    expect(mock.send).toHaveBeenCalledWith(JSON.stringify({ type: 'ping' }))
  })

  it('parses incoming messages', () => {
    ws = new ReconnectingWs({ url: 'ws://test', onMessage })
    const mock = (ws as any).ws as MockWebSocket
    mock.triggerOpen()
    mock.triggerMessage(JSON.stringify({ type: 'message', data: { content: 'hi' } }))
    expect(onMessage).toHaveBeenCalledWith({ type: 'message', data: { content: 'hi' } })
  })

  it('ignores malformed messages', () => {
    ws = new ReconnectingWs({ url: 'ws://test', onMessage })
    const mock = (ws as any).ws as MockWebSocket
    mock.triggerOpen()
    mock.triggerMessage('not json')
    expect(onMessage).not.toHaveBeenCalled()
  })

  it('destroy() cleans up', () => {
    ws = new ReconnectingWs({ url: 'ws://test', onMessage })
    const mock = (ws as any).ws as MockWebSocket
    mock.triggerOpen()
    ws.destroy()
    expect(mock.close).toHaveBeenCalled()
    expect(ws.isConnected()).toBe(false)
  })
})
