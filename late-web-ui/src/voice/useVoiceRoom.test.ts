import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVoiceRoom } from './useVoiceRoom'

let peerInstances: any[] = []

const { signalingHandlers, mockSignalingInstance } = vi.hoisted(() => {
  const handlers = new Map<string, Set<(data: any) => void>>()
  const instance: Record<string, any> = {
    join: vi.fn(),
    leave: vi.fn(),
    sendOffer: vi.fn(),
    sendAnswer: vi.fn(),
    sendIce: vi.fn(),
    sendHangup: vi.fn(),
    on: vi.fn((type: string, handler: (data: any) => void) => {
      if (!handlers.has(type)) handlers.set(type, new Set())
      handlers.get(type)!.add(handler)
      return () => handlers.get(type)?.delete(handler)
    }),
    destroy: vi.fn(),
  }
  return { signalingHandlers: handlers, mockSignalingInstance: instance }
})

vi.mock('./signaling', () => ({
  createVoiceSignaling: vi.fn(() => mockSignalingInstance),
}))

vi.mock('./peer', () => ({
  VoicePeer: vi.fn().mockImplementation(function () {
    const inst = {
      createOffer: vi.fn().mockResolvedValue('{"type":"offer","sdp":"test-offer"}'),
      createAnswer: vi.fn().mockResolvedValue('{"type":"answer","sdp":"test-answer"}'),
      handleOffer: vi.fn().mockResolvedValue(undefined),
      handleAnswer: vi.fn().mockResolvedValue(undefined),
      handleIce: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
      connectionState: 'connected',
    }
    peerInstances.push(inst)
    return inst
  }),
}))

async function emit(type: string, data: any) {
  for (const h of signalingHandlers.get(type) ?? []) {
    await h(data)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  signalingHandlers.clear()
  peerInstances = []
})

describe('useVoiceRoom', () => {
  it('returns initial state with connected=false, peers=[]', () => {
    const { result } = renderHook(() => useVoiceRoom(vi.fn(), null))
    expect(result.current.connected).toBe(false)
    expect(result.current.peers).toEqual([])
  })

  it('joinRoom calls signaling.join', () => {
    const sendViaWs = vi.fn()
    const { result } = renderHook(() => useVoiceRoom(sendViaWs, null))
    act(() => { result.current.joinRoom('my-room') })
    expect(mockSignalingInstance.join).toHaveBeenCalledWith('my-room')
  })

  it('peer_joined creates a new peer and sends offer', async () => {
    const { result } = renderHook(() => useVoiceRoom(vi.fn(), null))
    await act(async () => {
      await emit('peer_joined', { user_id: 1, display_name: 'Alice' })
    })
    expect(result.current.peers).toHaveLength(1)
    expect(result.current.peers[0].id).toBe(1)
    expect(result.current.peers[0].displayName).toBe('Alice')
    expect(peerInstances[0].createOffer).toHaveBeenCalled()
  })

  it('peers event adds existing peers (non-initiator)', async () => {
    const { result } = renderHook(() => useVoiceRoom(vi.fn(), null))
    await act(async () => {
      await emit('peers', [1, 2])
    })
    expect(result.current.peers).toHaveLength(2)
    expect(result.current.connected).toBe(true)
    expect(peerInstances[0].createOffer).not.toHaveBeenCalled()
  })

  it('peer_left removes peer', async () => {
    const { result } = renderHook(() => useVoiceRoom(vi.fn(), null))
    await act(async () => { await emit('peer_joined', { user_id: 1, display_name: 'Alice' }) })
    expect(result.current.peers).toHaveLength(1)
    await act(async () => { await emit('peer_left', { user_id: 1 }) })
    expect(result.current.peers).toHaveLength(0)
  })

  it('offer event triggers handleOffer + createAnswer + sendAnswer', async () => {
    const { result } = renderHook(() => useVoiceRoom(vi.fn(), null))
    await act(async () => { await emit('peers', [1]) })
    await act(async () => {
      await emit('offer', { from: 1, from_display_name: 'Alice', sdp: '{"type":"offer","sdp":"test"}' })
    })
    expect(peerInstances[0].handleOffer).toHaveBeenCalled()
    expect(peerInstances[0].createAnswer).toHaveBeenCalled()
  })

  it('answer event triggers handleAnswer', async () => {
    const { result } = renderHook(() => useVoiceRoom(vi.fn(), null))
    await act(async () => { await emit('peer_joined', { user_id: 1, display_name: 'Alice' }) })
    await act(async () => {
      await emit('answer', { from: 1, sdp: '{"type":"answer","sdp":"test"}' })
    })
    expect(peerInstances[0].handleAnswer).toHaveBeenCalled()
  })

  it('ice event triggers handleIce', async () => {
    const { result } = renderHook(() => useVoiceRoom(vi.fn(), null))
    await act(async () => { await emit('peer_joined', { user_id: 1, display_name: 'Alice' }) })
    await act(async () => {
      await emit('ice', { from: 1, candidate: '{"candidate":"1"}' })
    })
    expect(peerInstances[0].handleIce).toHaveBeenCalled()
  })

  it('hangup event removes peer', async () => {
    const { result } = renderHook(() => useVoiceRoom(vi.fn(), null))
    await act(async () => { await emit('peer_joined', { user_id: 1, display_name: 'Alice' }) })
    expect(result.current.peers).toHaveLength(1)
    await act(async () => { await emit('hangup', { user_id: 1 }) })
    expect(result.current.peers).toHaveLength(0)
  })

  it('kicked event resets state', async () => {
    const { result } = renderHook(() => useVoiceRoom(vi.fn(), null))
    await act(async () => { await emit('peers', [1]) })
    expect(result.current.connected).toBe(true)
    await act(async () => { await emit('kicked', { by: 2, by_display_name: 'Admin', channel_id: 1 }) })
    expect(result.current.connected).toBe(false)
    expect(result.current.peers).toHaveLength(0)
  })

  it('cleanup on unmount calls destroy', () => {
    const { unmount } = renderHook(() => useVoiceRoom(vi.fn(), null))
    unmount()
    expect(mockSignalingInstance.destroy).toHaveBeenCalled()
  })
})
