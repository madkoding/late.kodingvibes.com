import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VoicePeer } from './peer'

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]

function makeStream() {
  return new MediaStream()
}

function makePeer(overrides?: Partial<Parameters<typeof VoicePeer.prototype.constructor>>) {
  const callbacks = {
    onIceCandidate: vi.fn(),
    onStream: vi.fn(),
    onConnectionState: vi.fn(),
  }
  const peer = new VoicePeer(
    overrides?.[0] as number ?? 1,
    overrides?.[1] as boolean ?? false,
    callbacks,
    overrides?.[3] as MediaStream | undefined,
  )
  return { peer, callbacks }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('VoicePeer', () => {
  it('constructor creates RTCPeerConnection with iceServers', () => {
    const { peer } = makePeer()
    expect((peer as any).pc.iceServers).toEqual(ICE_SERVERS)
  })

  it('constructor adds localStream tracks via addTrack', () => {
    const stream = makeStream()
    const addTrack = vi.fn()
    stream.getTracks = vi.fn(() => [{ stop: () => {} }] as any)
    const origAddTrack = (window as any).RTCPeerConnection.prototype.addTrack
    ;(window as any).RTCPeerConnection.prototype.addTrack = addTrack
    const { peer } = makePeer([1, false, { onIceCandidate: vi.fn(), onStream: vi.fn(), onConnectionState: vi.fn() }, stream])
    expect(addTrack).toHaveBeenCalled()
    ;(window as any).RTCPeerConnection.prototype.addTrack = origAddTrack
  })

  it('createOffer calls setLocalDescription and returns JSON string', async () => {
    const { peer } = makePeer()
    const setLD = vi.spyOn((peer as any).pc, 'setLocalDescription')
    const sdp = await peer.createOffer()
    expect(setLD).toHaveBeenCalled()
    expect(typeof sdp).toBe('string')
    const parsed = JSON.parse(sdp)
    expect(parsed.type).toBe('offer')
  })

  it('createAnswer calls setLocalDescription and returns JSON string', async () => {
    const { peer } = makePeer()
    const setLD = vi.spyOn((peer as any).pc, 'setLocalDescription')
    const sdp = await peer.createAnswer()
    expect(setLD).toHaveBeenCalled()
    expect(typeof sdp).toBe('string')
    const parsed = JSON.parse(sdp)
    expect(parsed.type).toBe('answer')
  })

  it('handleOffer sets remote description and flushes pending ICE candidates', async () => {
    const { peer } = makePeer()
    const setRD = vi.spyOn((peer as any).pc, 'setRemoteDescription')
    const addIce = vi.spyOn((peer as any).pc, 'addIceCandidate')
    ;(peer as any).pendingIce = ['{"candidate":"1"}', '{"candidate":"2"}']
    await peer.handleOffer('{"type":"offer","sdp":"test"}')
    expect(setRD).toHaveBeenCalled()
    expect(addIce).toHaveBeenCalledTimes(2)
    expect((peer as any).pendingIce).toEqual([])
  })

  it('handleAnswer sets remote description and flushes pending ICE', async () => {
    const { peer } = makePeer()
    const setRD = vi.spyOn((peer as any).pc, 'setRemoteDescription')
    const addIce = vi.spyOn((peer as any).pc, 'addIceCandidate')
    ;(peer as any).pendingIce = ['{"candidate":"1"}']
    await peer.handleAnswer('{"type":"answer","sdp":"test"}')
    expect(setRD).toHaveBeenCalled()
    expect(addIce).toHaveBeenCalledTimes(1)
    expect((peer as any).pendingIce).toEqual([])
  })

  it('handleIce adds candidate when remote description exists', async () => {
    const { peer } = makePeer()
    ;(peer as any).pc.remoteDescription = { type: 'offer', sdp: '' }
    const addIce = vi.spyOn((peer as any).pc, 'addIceCandidate')
    await peer.handleIce('{"candidate":"1"}')
    expect(addIce).toHaveBeenCalled()
    expect((peer as any).pendingIce).toEqual([])
  })

  it('handleIce queues candidate when remote description does not exist', async () => {
    const { peer } = makePeer()
    ;(peer as any).pc.remoteDescription = null
    const addIce = vi.spyOn((peer as any).pc, 'addIceCandidate')
    await peer.handleIce('{"candidate":"1"}')
    expect(addIce).not.toHaveBeenCalled()
    expect((peer as any).pendingIce).toEqual(['{"candidate":"1"}'])
  })

  it('close() calls pc.close()', () => {
    const { peer } = makePeer()
    const close = vi.spyOn((peer as any).pc, 'close')
    peer.close()
    expect(close).toHaveBeenCalled()
  })

  it('onIceCandidate callback fires on icecandidate event', () => {
    const callbacks = {
      onIceCandidate: vi.fn(),
      onStream: vi.fn(),
      onConnectionState: vi.fn(),
    }
    const peer = new VoicePeer(1, false, callbacks)
    const candidate = { candidate: 'candidate:1 1 UDP 2122252543 192.168.1.1 54321 typ host' }
    ;(peer as any).pc.onicecandidate?.({ candidate })
    expect(callbacks.onIceCandidate).toHaveBeenCalledWith(JSON.stringify(candidate))
  })

  it('onStream callback fires on track event', () => {
    const callbacks = {
      onIceCandidate: vi.fn(),
      onStream: vi.fn(),
      onConnectionState: vi.fn(),
    }
    const peer = new VoicePeer(1, false, callbacks)
    const stream = new MediaStream()
    ;(peer as any).pc.ontrack?.({ streams: [stream] })
    expect(callbacks.onStream).toHaveBeenCalledWith(stream)
  })

  it('onConnectionState callback fires on connectionstatechange', () => {
    const callbacks = {
      onIceCandidate: vi.fn(),
      onStream: vi.fn(),
      onConnectionState: vi.fn(),
    }
    const peer = new VoicePeer(1, false, callbacks)
    ;(peer as any).pc.connectionState = 'connected'
    ;(peer as any).pc.onconnectionstatechange?.()
    expect(callbacks.onConnectionState).toHaveBeenCalledWith('connected')
  })

  it('exposes id and connectionState', () => {
    const { peer } = makePeer([42, false, { onIceCandidate: vi.fn(), onStream: vi.fn(), onConnectionState: vi.fn() }])
    expect(peer.id).toBe(42)
    expect(peer.connectionState).toBe('new')
  })
})
