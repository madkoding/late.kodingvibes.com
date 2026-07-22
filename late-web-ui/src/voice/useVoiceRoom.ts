import { useEffect, useRef, useState, useCallback } from 'react'
import { createVoiceSignaling, type VoiceSignaling } from './signaling'
import { VoicePeer } from './peer'

interface PeerState {
  id: number
  displayName: string
  stream: MediaStream | null
  speaking: boolean
}

export interface VoiceRoomState {
  connected: boolean
  peers: PeerState[]
  joinRoom: (roomId?: string) => void
  leaveRoom: (roomId?: string) => void
}

export function useVoiceRoom(
  sendViaWs: (msg: object) => void,
  localStream: MediaStream | null,
  onWsMessage?: (handler: (type: string, data: any) => void) => () => void,
): VoiceRoomState {
  const signalingRef = useRef<VoiceSignaling | null>(null)
  const peersRef = useRef<Map<number, VoicePeer>>(new Map())
  const [peers, setPeers] = useState<PeerState[]>([])
  const [connected, setConnected] = useState(false)
  const peerStreams = useRef<Map<number, MediaStream>>(new Map())
  const joined = useRef(false)

  useEffect(() => {
    const signaling = createVoiceSignaling(sendViaWs)
    signalingRef.current = signaling

    const unsubscribes: (() => void)[] = []

    const addPeer = (id: number, displayName: string, initiator: boolean) => {
      if (peersRef.current.has(id)) return

      const peer = new VoicePeer(
        id,
        initiator,
        {
          onIceCandidate: (candidate) => {
            signaling.sendIce(id, candidate)
          },
          onStream: (stream) => {
            peerStreams.current.set(id, stream)
            setPeers(prev => prev.map(p =>
              p.id === id ? { ...p, stream } : p,
            ))
          },
          onConnectionState: (state) => {
            if (state === 'disconnected' || state === 'failed') {
              peerStreams.current.delete(id)
              peersRef.current.delete(id)
              setPeers(prev => prev.filter(p => p.id !== id))
            }
          },
        },
        localStream ?? undefined,
      )

      peersRef.current.set(id, peer)
      setPeers(prev => [...prev, { id, displayName, stream: null, speaking: false }])

      // If we're the initiator (we joined first, this peer joined later),
      // create and send the offer
      if (initiator) {
        peer.createOffer().then(sdp => {
          signaling.sendOffer(id, sdp)
        })
      }
    }

    // Handle incoming signaling
    unsubscribes.push(
      signaling.on('peers', (peerIds: number[]) => {
        // Existing peers — we're the joiner, they're the initiators
        for (const pid of peerIds) {
          addPeer(pid, `User ${pid}`, false)
        }
        setConnected(true)
      }),
    )

    unsubscribes.push(
      signaling.on('peer_joined', (data: { user_id: number; display_name: string }) => {
        addPeer(data.user_id, data.display_name, true)
      }),
    )

    unsubscribes.push(
      signaling.on('peer_left', (data: { user_id: number }) => {
        const peer = peersRef.current.get(data.user_id)
        if (peer) {
          peer.close()
          peersRef.current.delete(data.user_id)
          peerStreams.current.delete(data.user_id)
          setPeers(prev => prev.filter(p => p.id !== data.user_id))
        }
      }),
    )

    unsubscribes.push(
      signaling.on('offer', async (data: { from: number; from_display_name: string; sdp: string }) => {
        // If we don't have this peer yet, add it
        if (!peersRef.current.has(data.from)) {
          addPeer(data.from, data.from_display_name, false)
        }
        const peer = peersRef.current.get(data.from)
        if (peer) {
          await peer.handleOffer(data.sdp)
          const answer = await peer.createAnswer()
          signaling.sendAnswer(data.from, answer)
        }
      }),
    )

    unsubscribes.push(
      signaling.on('answer', async (data: { from: number; sdp: string }) => {
        const peer = peersRef.current.get(data.from)
        if (peer) {
          await peer.handleAnswer(data.sdp)
        }
      }),
    )

    unsubscribes.push(
      signaling.on('ice', async (data: { from: number; candidate: string }) => {
        const peer = peersRef.current.get(data.from)
        if (peer) {
          await peer.handleIce(data.candidate)
        }
      }),
    )

    unsubscribes.push(
      signaling.on('hangup', (data: { user_id: number }) => {
        const peer = peersRef.current.get(data.user_id)
        if (peer) {
          peer.close()
          peersRef.current.delete(data.user_id)
          peerStreams.current.delete(data.user_id)
          setPeers(prev => prev.filter(p => p.id !== data.user_id))
        }
      }),
    )

    unsubscribes.push(
      signaling.on('kicked', (_data: { by: number; by_display_name: string; channel_id: number }) => {
        // The kick handler in Irc.tsx will set activeVoiceChannelId to null.
        // We just need to clean up local state.
        setConnected(false)
        peersRef.current.forEach(p => p.close())
        peersRef.current.clear()
        peerStreams.current.clear()
        setPeers([])
        joined.current = false
      }),
    )

    // Listen for incoming WS messages that contain voice.* events
    if (onWsMessage) {
      const unsub = onWsMessage((type: string, data: any) => {
        const emit = (t: string, d: any) => (signalingRef.current as any)?.emit(t, d)
        if (type === 'peers') emit('peers', data.peers)
        else if (type === 'peer_joined') emit('peer_joined', data)
        else if (type === 'peer_left') emit('peer_left', data)
        else if (type === 'offer') emit('offer', data)
        else if (type === 'answer') emit('answer', data)
        else if (type === 'ice') emit('ice', data)
        else if (type === 'hangup') emit('hangup', data)
        else if (type === 'kicked') emit('kicked', data)
      })
      unsubscribes.push(unsub)
    }

    return () => {
      unsubscribes.forEach(fn => fn())
      if (signalingRef.current) {
        if (joined.current) {
          signalingRef.current.sendHangup()
        }
        signalingRef.current.destroy()
      }
      peersRef.current.forEach(p => p.close())
      peersRef.current.clear()
      peerStreams.current.clear()
    }
    // We intentionally depend on localStream to rebuild when
    // the mic is toggled, but keep the signaling layer alive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream])

  const joinRoom = useCallback((roomId?: string) => {
    if (!signalingRef.current) return
    const id = roomId || 'lobby'
    signalingRef.current.join(id)
    joined.current = true
  }, [])

  const leaveRoom = useCallback((roomId?: string) => {
    if (!signalingRef.current) return
    const id = roomId || 'lobby'
    signalingRef.current.sendHangup()
    signalingRef.current.leave(id)
    joined.current = false
    setConnected(false)
    peersRef.current.forEach(p => p.close())
    peersRef.current.clear()
    peerStreams.current.clear()
    setPeers([])
  }, [])

  return { connected, peers, joinRoom, leaveRoom }
}
