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

// Enable with ?voiceDebug=1 in the URL, or by setting
// window.__voiceDebug.enabled = true in DevTools before the channel loads.
const VOICE_DEBUG = new URLSearchParams(window.location.search).has('voiceDebug')
;(window as any).__voiceDebug = {
  enabled: VOICE_DEBUG,
  events: [] as Array<{ t: string; e: string; d?: unknown }>,
  copy: () => {
    const text = JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        events: (window as any).__voiceDebug.events,
      },
      null,
      2,
    )
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false)
  },
}
if (VOICE_DEBUG) {
  // eslint-disable-next-line no-console
  console.log('[voice] debug ON (via ?voiceDebug=1) — set window.__voiceDebug.enabled = true to toggle at runtime; copy() to dump the log')
}
const vd = (event: string, data?: unknown) => {
  if (!(window as any).__voiceDebug?.enabled) return
  const ts = new Date().toISOString().slice(11, 23)
  // eslint-disable-next-line no-console
  console.log(`[voice ${ts}] ${event}`, data ?? '')
}
const vdRecord = (event: string, data?: unknown) => {
  if (!(window as any).__voiceDebug?.enabled) return
  ;(window as any).__voiceDebug.events.push({ t: new Date().toISOString(), e: event, d: data })
  if ((window as any).__voiceDebug.events.length > 200) (window as any).__voiceDebug.events.shift()
  vd(event, data)
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
  // localStream arrives after getUserMedia resolves, often AFTER peers
  // are added. We keep a ref so addPeer() can read the latest value
  // and so the closure inside the big effect (which runs once) doesn't
  // pin the null from mount time.
  const localStreamRef = useRef<MediaStream | null>(localStream)
  useEffect(() => { localStreamRef.current = localStream }, [localStream])

  useEffect(() => {
    const signaling = createVoiceSignaling(sendViaWs)
    signalingRef.current = signaling

    const unsubscribes: (() => void)[] = []

    const addPeer = (id: number, displayName: string, initiator: boolean) => {
      const streamNow = localStreamRef.current
      vdRecord('addPeer', { id, displayName, initiator, hasLocalStream: !!streamNow })
      // If we already have a peer and it's in a bad state, tear it
      // down and recreate so a re-join (after the remote got dropped
      // and reconnected) actually negotiates a fresh session.
      const existing = peersRef.current.get(id)
      if (existing) {
        const st = existing.connectionState
        if (st === 'disconnected' || st === 'failed' || st === 'closed') {
          vdRecord('addPeer.replace.stale', { id, oldState: st })
          existing.close()
          peersRef.current.delete(id)
          peerStreams.current.delete(id)
          setPeers(prev => prev.filter(p => p.id !== id))
        } else {
          vdRecord('addPeer.skip.duplicate', { id, state: st })
          return
        }
      }

      const peer = new VoicePeer(
        id,
        initiator,
        {
          onIceCandidate: (candidate) => {
            vdRecord('ice.local', { to: id })
            signaling.sendIce(id, candidate)
          },
          onStream: (stream) => {
            vdRecord('peer.stream', { id, tracks: stream.getTracks().map(t => t.kind) })
            peerStreams.current.set(id, stream)
            setPeers(prev => prev.map(p =>
              p.id === id ? { ...p, stream } : p,
            ))
          },
          onConnectionState: (state) => {
            vdRecord('peer.connectionState', { id, state })
            if (state === 'disconnected' || state === 'failed') {
              peerStreams.current.delete(id)
              peersRef.current.delete(id)
              setPeers(prev => prev.filter(p => p.id !== id))
              // ponytail: try an ICE restart before giving up. The
              // connection is still alive (close() hasn't been called),
              // we just lost the candidate path. A fresh offer with
              // iceRestart:true re-gathers and re-pings. If we're the
              // initiator, send the new offer; if we're the answerer,
              // we have to wait for the remote to re-offer (restartIce
              // returns null in that case, which we log).
              if (initiator) {
                peer.restartIce()
                  .then(sdp => {
                    if (sdp) signaling.sendOffer(id, sdp)
                    else vdRecord('ice.restart.no-offer', { id, role: 'answerer' })
                  })
                  .catch(err => vdRecord('ice.restart.err', { id, msg: String(err) }))
              }
            }
          },
        },
        streamNow ?? undefined,
      )

      peersRef.current.set(id, peer)
      setPeers(prev => [...prev, { id, displayName, stream: null, speaking: false }])

      // If the local mic is already available, attach its tracks to
      // the new peer. VoicePeer.addLocalStream is a no-op for tracks
      // that are already on the connection, so this is safe to call
      // whether or not the peer was constructed with a stream.
      if (streamNow) {
        peer.addLocalStream(streamNow)
          .then(result => {
            if (!result) return
            if (result.kind === 'offer') signaling.sendOffer(id, result.sdp)
            else signaling.sendAnswer(id, result.sdp)
          })
          .catch(err => vdRecord('addPeer.renegotiate.err', { id, msg: String(err) }))
      }

      // If we're the initiator (we joined first, this peer joined later),
      // create and send the offer
      if (initiator) {
        vdRecord('offer.create.start', { to: id })
        peer.createOffer()
          .then(sdp => {
            vdRecord('offer.create.ok', { to: id, sdpLen: sdp?.length })
            signaling.sendOffer(id, sdp)
          })
          .catch(err => vdRecord('offer.create.err', { to: id, msg: String(err) }))
      }
    }

    // Handle incoming signaling
    unsubscribes.push(
      signaling.on('peers', (peers: Array<{ user_id: number; display_name: string }> | number[]) => {
        const list = Array.isArray(peers)
          ? peers.map(p => typeof p === 'number' ? { user_id: p, display_name: '' } : p)
          : []
        vdRecord('signaling.peers', { count: list.length })
        // Existing peers — we're the joiner, they're the initiators
        for (const p of list) {
          addPeer(p.user_id, p.display_name || `User ${p.user_id}`, false)
        }
        setConnected(true)
      }),
    )

    unsubscribes.push(
      signaling.on('peer_joined', (data: { user_id: number; display_name: string }) => {
        vdRecord('signaling.peer_joined', data)
        addPeer(data.user_id, data.display_name, true)
      }),
    )

    unsubscribes.push(
      signaling.on('peer_left', (data: { user_id: number }) => {
        vdRecord('signaling.peer_left', data)
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
        vdRecord('signaling.offer.in', { from: data.from, sdpLen: data.sdp?.length })
        // If we don't have this peer yet, add it
        if (!peersRef.current.has(data.from)) {
          addPeer(data.from, data.from_display_name, false)
        }
        const peer = peersRef.current.get(data.from)
        if (peer) {
          await peer.handleOffer(data.sdp)
          const answer = await peer.createAnswer()
          vdRecord('answer.create.ok', { to: data.from, sdpLen: answer?.length })
          signaling.sendAnswer(data.from, answer)
        } else {
          vdRecord('offer.in.no-peer', { from: data.from })
        }
      }),
    )

    unsubscribes.push(
      signaling.on('answer', async (data: { from: number; sdp: string }) => {
        vdRecord('signaling.answer.in', { from: data.from, sdpLen: data.sdp?.length })
        const peer = peersRef.current.get(data.from)
        if (peer) {
          await peer.handleAnswer(data.sdp)
        } else {
          vdRecord('answer.in.no-peer', { from: data.from })
        }
      }),
    )

    unsubscribes.push(
      signaling.on('ice', async (data: { from: number; candidate: string }) => {
        vdRecord('signaling.ice.in', { from: data.from, hasCandidate: !!data.candidate })
        const peer = peersRef.current.get(data.from)
        if (peer) {
          await peer.handleIce(data.candidate)
        } else {
          vdRecord('ice.in.no-peer', { from: data.from })
        }
      }),
    )

    unsubscribes.push(
      signaling.on('hangup', (data: { user_id: number }) => {
        vdRecord('signaling.hangup.in', data)
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
        vdRecord('signaling.kicked.in', _data)
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
        vdRecord('ws.in', { type, keys: data ? Object.keys(data) : null })
        const sig = signalingRef.current
        if (!sig) {
          vdRecord('ws.in.no-signaling', { type })
          return
        }
        if (type === 'peers') sig.emit('peers', data.peers)
        else if (type === 'peer_joined') sig.emit('peer_joined', data)
        else if (type === 'peer_left') sig.emit('peer_left', data)
        else if (type === 'offer') sig.emit('offer', data)
        else if (type === 'answer') sig.emit('answer', data)
        else if (type === 'ice') sig.emit('ice', data)
        else if (type === 'hangup') sig.emit('hangup', data)
        else if (type === 'kicked') sig.emit('kicked', data)
        else vdRecord('ws.in.unhandled', { type })
      })
      unsubscribes.push(unsub)
    }

    return () => {
      unsubscribes.forEach(fn => fn())
      if (signalingRef.current) {
        // Don't send hangup on unmount/rebuild — the parent component's
        // leaveRoom() handles explicit leaves. We only tear down local
        // state so the next mount can start fresh.
        signalingRef.current.destroy()
      }
      peersRef.current.forEach(p => p.close())
      peersRef.current.clear()
      peerStreams.current.clear()
    }
    // ponytail: empty deps — the room bridge must outlive the mic
    // stream resolving. Previously this depended on [localStream], which
    // tore down (and auto-hung up) the moment getUserMedia resolved, so
    // the joiner never stayed in the room. Mic-track hot-swap is not
    // implemented; if you need it, add a peer.replaceTrack() call when
    // localStream changes, don't re-run the whole effect.
  }, [])

  // ponytail: When the mic stream resolves, re-negotiate every peer
  // that was created without an audio track. The big effect runs once
  // (see ponytail note above), so we do this in a separate effect that
  // depends on localStream. Without this, peers added before
  // getUserMedia resolves never send audio.
  useEffect(() => {
    if (!localStream) return
    const sig = signalingRef.current
    if (!sig) return
    for (const peer of peersRef.current.values()) {
      peer.addLocalStream(localStream)
        .then(result => {
          if (!result) return
          if (result.kind === 'offer') sig.sendOffer(peer.id, result.sdp)
          else sig.sendAnswer(peer.id, result.sdp)
        })
        .catch(err => vdRecord('renegotiate.err', { id: peer.id, msg: String(err) }))
    }
  }, [localStream])

  const joinRoom = useCallback((roomId?: string) => {
    if (!signalingRef.current) return
    const id = roomId || 'lobby'
    vdRecord('join.send', { roomId: id })
    signalingRef.current.join(id)
    joined.current = true
  }, [])

  const leaveRoom = useCallback((roomId?: string) => {
    if (!signalingRef.current) return
    const id = roomId || 'lobby'
    vdRecord('leave.send', { roomId: id })
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
