import { useState, useRef, useCallback, useEffect } from 'react'
import { MessageSquare, Mic, MicOff, Activity, Plus, Image as ImageIcon, Smile, Music, Video, FileText, ArrowUp, X } from 'lucide-react'
import ParticipantTile from './ParticipantTile'
import MessageList from './MessageList'
import TypingIndicator from './TypingIndicator'
import { useVoiceRoom } from '../../voice/useVoiceRoom'
import { useAudioLevel } from '../../hooks/useAudioLevel'
import { getOrCreateAudioContext, resumeAudioContext } from '../../voice/audioContext'
import type { ChannelState, ChatMessage } from '../../lib/chat/domain/types'

interface PeerState {
  id: number
  displayName: string
  stream: MediaStream | null
  speaking: boolean
}

interface VoiceRoomViewProps {
  channel: ChannelState
  myUserId: number | null
  myRole: string | null
  nick: string
  nickMap: Map<number, string>
  sendViaWs: (msg: object) => void
  onVoiceMessage: (handler: (type: string, data: any) => void) => () => void
  onSendMessage: (channelId: number, content: string) => void
}

const VAD_THRESHOLD_DEFAULT = 0.05

export default function VoiceRoomView({
  channel, myUserId, myRole, nick, nickMap,
  sendViaWs, onVoiceMessage, onSendMessage,
}: VoiceRoomViewProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [showInput, setShowInput] = useState(false)
  const [replyContext, setReplyContext] = useState<ChatMessage | null>(null)
  const [pttActive, setPttActive] = useState(false)
  const [vadOn, setVadOn] = useState(false)
  const [vadThreshold, setVadThreshold] = useState(VAD_THRESHOLD_DEFAULT)
  const [micReady, setMicReady] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [vadStream, setVadStream] = useState<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const gateRef = useRef<GainNode | null>(null)

  const level = useAudioLevel(vadStream)
  const vadOpen = vadOn && !pttActive && level >= vadThreshold
  const micEnabled = pttActive || vadOpen

  const voiceRoom = useVoiceRoom(sendViaWs, localStream, onVoiceMessage)

  const peerVolumes = useRef<Map<number, number>>(new Map())
  const peerMuted = useRef<Map<number, boolean>>(new Map())

  useEffect(() => {
    voiceRoom.joinRoom(String(channel.id))
    return () => voiceRoom.leaveRoom(String(channel.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id])

  useEffect(() => {
    let cancelled = false
    setMicError(null)
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    }
      navigator.mediaDevices.getUserMedia(constraints)
      .then(async stream => {
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        const liveTrack = stream.getAudioTracks()[0]
        const vadTrack = liveTrack?.clone() ?? null
        if (vadTrack) {
          vadTrack.enabled = true
          setVadStream(new MediaStream([vadTrack]))
        }

        // ponytail: send the raw stream to the peer. The browser's
        // built-in echo cancellation / noise suppression / AGC (from
        // the getUserMedia constraints) is enough. The earlier custom
        // DSP chain (highpass + lowpass + compressor + gain 1.4) was
        // amplifying ambient noise + the headless test tone into a
        // white-noise hash on the receiving end. If a custom chain
        // is needed later, gate it behind a flag and verify on real
        // audio, don't ship an untuned one.
        //
        // We DO wrap the stream in a Web Audio graph with a single
        // GainNode so PTT / VAD can mute the audio by setting
        // gain=0 instead of toggling track.enabled. Disabling the
        // track stops the browser from sending RTP, which lets the
        // NAT mapping die after ~30s of silence — that's why the
        // remote stopped hearing the user after the first sentence.
        // With this gate, packets still flow (silence frames) and
        // the connection stays alive.

        let processed: MediaStream | null = null
        // ponytail: reuse the AudioContext that IrcPage created inside
        // the click handler. Creating a fresh `new AudioContext()` here
        // is too late on iOS Safari — the user gesture has already
        // unwound, the context stays suspended, and
        // MediaStreamAudioDestinationNode emits silent tracks.
        const audioCtx = getOrCreateAudioContext()
        await resumeAudioContext()
        const source = audioCtx.createMediaStreamSource(stream)
        const gate = audioCtx.createGain()
        gate.gain.value = 1
        const dest = audioCtx.createMediaStreamDestination()
        source.connect(gate)
        gate.connect(dest)
        processed = dest.stream
        gateRef.current = gate

        micStreamRef.current = stream
        setLocalStream(processed)
        setMicReady(true)
      })
      .catch(() => {
        if (!cancelled) setMicError('No se pudo acceder al micrófono')
      })
    return () => {
      cancelled = true
      micStreamRef.current?.getTracks().forEach(t => t.stop())
      micStreamRef.current = null
      if (gateRef.current) {
        const ctx = gateRef.current.context as AudioContext
        ctx.close?.().catch(() => {})
        gateRef.current = null
      }
      vadStream?.getTracks().forEach(t => t.stop())
      setVadStream(null)
    }
  }, [])

  // ponytail: keep the mic track enabled and the audio always
  // flowing. Disabling the track on PTT release / VAD close stopped
  // the browser from sending RTP, which let the NAT mapping die
  // after ~30s of silence. Mute via the Web Audio gain instead so
  // silence frames (DTX) keep the connection alive.
  useEffect(() => {
    const gate = gateRef.current
    if (!gate) return
    // Smooth ramp avoids clicks; ~30ms is inaudible.
    const now = gate.context.currentTime
    gate.gain.cancelScheduledValues(now)
    gate.gain.setValueAtTime(gate.gain.value, now)
    gate.gain.linearRampToValueAtTime(micEnabled ? 1 : 0, now + 0.03)
  }, [micEnabled])

  const pttPress = useCallback(() => {
    if (!micReady) return
    setPttActive(true)
  }, [micReady])
  const pttRelease = useCallback(() => setPttActive(false), [])

  useEffect(() => {
    if (!micReady) return
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      e.preventDefault()
      pttPress()
    }
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      pttRelease()
    }
    const blur = () => pttRelease()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [micReady, pttPress, pttRelease])

  const peers: PeerState[] = voiceRoom.peers
  const totalConnected = peers.length + (micReady ? 1 : 0)

  const handleKick = useCallback((targetUserId: number) => {
    sendViaWs({
      type: 'voice.peer_kick',
      target_user_id: targetUserId,
      channel_id: channel.id,
    })
  }, [sendViaWs, channel.id])

  const isAdmin = myRole === 'admin'

  const handleSend = useCallback((text: string) => {
    const isAction = text.startsWith('/me ')
    const payload = isAction ? text.slice(4).trim() : text
    onSendMessage(channel.id, payload)
    setReplyContext(null)
  }, [channel.id, onSendMessage])

  return (
    <div className="flex flex-col h-full bg-slate-950/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-base">🔊</span>
          <span className="text-sm font-semibold text-slate-100">
            {channel.name.replace(/^🔊\s*/, '')}
          </span>
          <span className="text-xs text-slate-500">
            {totalConnected} conectado{totalConnected !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={() => setShowInput(!showInput)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            showInput
              ? 'bg-indigo-500/15 text-indigo-300'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {showInput ? 'Cerrar chat' : 'Mensaje'}
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left column: participants + PTT */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {/* Self tile */}
            <ParticipantTile
              userId={myUserId ?? 0}
              displayName={nick}
              stream={localStream}
              isSelf
              micOn={micEnabled}
              speaking={micEnabled && voiceRoom.peers.length > 0}
              isAdmin={false}
              volume={100}
              locallyMuted={false}
              onVolumeChange={() => {}}
              onLocalMuteToggle={() => {}}
            />
            {/* Peer tiles */}
            {peers.map(p => {
              const vol = peerVolumes.current.get(p.id) ?? 100
              const muted = peerMuted.current.get(p.id) ?? false
              return (
                <ParticipantTile
                  key={p.id}
                  userId={p.id}
                  displayName={nickMap.get(p.id) ?? p.displayName}
                  stream={p.stream}
                  isSelf={false}
                  micOn
                  speaking={p.speaking}
                  isAdmin={isAdmin}
                  volume={vol}
                  locallyMuted={muted}
                  onVolumeChange={(v) => {
                    peerVolumes.current.set(p.id, v)
                    sendViaWs({ type: 'voice.peer_volume', to: p.id, volume: v })
                  }}
                  onLocalMuteToggle={() => {
                    const next = !peerMuted.current.get(p.id)
                    peerMuted.current.set(p.id, next)
                    sendViaWs({ type: 'voice.peer_local_mute', to: p.id, muted: next })
                  }}
                  onKick={isAdmin ? () => handleKick(p.id) : undefined}
                />
              )
            })}
          </div>
          {/* PTT control panel */}
          <div className="mt-6 flex flex-col items-center gap-3">
            {micError ? (
              <div className="text-center">
                <p className="text-sm text-rose-400">{micError}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Revisá los permisos del navegador para este sitio.
                </p>
              </div>
            ) : !micReady ? (
              <p className="text-xs text-slate-500">Solicitando micrófono…</p>
            ) : (
              <>
                <button
                  onMouseDown={pttPress}
                  onMouseUp={pttRelease}
                  onMouseLeave={pttRelease}
                  onTouchStart={(e) => { e.preventDefault(); pttPress() }}
                  onTouchEnd={(e) => { e.preventDefault(); pttRelease() }}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all select-none ${
                    pttActive
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-105'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-100 active:scale-95'
                  }`}
                  title="Mantené presionado o Space para hablar"
                >
                  {pttActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  {pttActive ? 'Hablando…' : 'Mantener para hablar'}
                </button>
                <div className="flex flex-col items-center gap-1.5">
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={vadOn}
                      onChange={e => setVadOn(e.target.checked)}
                      className="accent-indigo-500"
                    />
                    <Activity className="w-3 h-3" />
                    Auto-detectar voz
                  </label>
                  {vadOn && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">Umbral</span>
                      <input
                        type="range"
                        min="0" max="100"
                        value={Math.round(vadThreshold * 200)}
                        onChange={e => setVadThreshold(Number(e.target.value) / 200)}
                        className="w-32 h-1 accent-indigo-500"
                      />
                      <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-400 transition-[width] duration-75"
                          style={{ width: `${Math.min(100, level * 400)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-500 tabular-nums w-4 text-right">
                        {vadOpen ? 'on' : '—'}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-500">
                  Tip: mantené <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-300">Space</kbd> para hablar sin click.
                </p>
              </>
            )}
          </div>
          {peers.length === 0 && micReady && (
            <div className="flex items-center justify-center pt-6">
              <p className="text-xs text-slate-500">
                Esperando a que alguien se conecte…
              </p>
            </div>
          )}
        </div>

        {/* Right column: text chat (only when toggled on).
            Forced "compact" mode so the icon row collapses into a
            single + menu and the textarea gets the smaller
            min-height the mobile layout uses. Without this the
            3 × w-10 attach buttons + 44px textarea crowd out the
            320px panel. */}
        {showInput && (
          <div className="w-72 flex-shrink-0 border-l border-slate-800 flex flex-col bg-slate-950">
            <div className="flex-1 overflow-y-auto min-h-0">
              <MessageList
                messages={channel.messages}
                currentNick={nick}
                channelName={channel.name}
                channelMembers={channel.members || []}
                nickByUserId={nickMap}
                myUserId={myUserId}
                myRole={myRole}
                onToggleReaction={() => {}}
                onLoadMore={() => {}}
                loadingMore={false}
                hasMore={false}
                onReply={(msg) => setReplyContext(msg)}
                onForward={() => {}}
                onBuzz={() => {}}
                onCopyText={() => {}}
                onHide={async () => {}}
                onDelete={async () => {}}
              />
            </div>
            <TypingIndicator names={[]} />
            <VoiceChatInput
              onSend={handleSend}
              placeholder={`Mensaje en ${channel.name}`}
              replyContext={replyContext}
              onClearReply={() => setReplyContext(null)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// Compact chat input for the voice room side panel. Always renders
// in mobile layout (single + menu instead of 3 attach buttons, smaller
// textarea) so the 288px panel isn't crowded out by oversized icons.
// ponytail: text-only. File/emoji pickers open the OS file dialog or
// just append a smiley — full attachment flow lives in the regular
// MessageInput used outside the voice room.
function VoiceChatInput({
  onSend, placeholder, replyContext, onClearReply,
}: {
  onSend: (text: string) => void
  placeholder: string
  replyContext: ChatMessage | null
  onClearReply: () => void
}) {
  const [text, setText] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingKind, setPendingKind] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showMenu) return
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [showMenu])

  const submit = () => {
    const t = text.trim()
    if (!t) return
    onSend(t)
    setText('')
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit() }}
      className="px-2 py-1.5 border-t border-slate-800 bg-slate-950"
    >
      {replyContext && (
        <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-400">
          <span className="truncate">Respondiendo a <span className="text-indigo-300">{replyContext.display_name}</span></span>
          <button type="button" onClick={onClearReply} className="ml-auto text-slate-500 hover:text-slate-200">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-1.5 min-w-0">
        <input
          ref={fileInputRef}
          type="file"
          accept={pendingKind === 'image' ? 'image/*' : pendingKind === 'video' ? 'video/*' : pendingKind === 'audio' ? 'audio/*' : '*/*'}
          className="hidden"
          onChange={(e) => {
            // ponytail: no upload wired here — drop the selection so
            // the menu doesn't show a broken state. Full flow lives
            // in the regular MessageInput outside the voice room.
            e.target.value = ''
            setPendingKind(null)
          }}
        />
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setShowMenu(v => !v)}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 flex items-center justify-center flex-shrink-0 transition-colors"
            aria-label="Más opciones"
          >
            <Plus className="w-4 h-4" />
          </button>
          {showMenu && (
            <div className="absolute bottom-full mb-1 left-0 z-40 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1 w-36">
              {[
                { kind: 'image', icon: ImageIcon, label: 'Imagen' },
                { kind: 'audio', icon: Music, label: 'Audio' },
                { kind: 'video', icon: Video, label: 'Video' },
                { kind: 'document', icon: FileText, label: 'Documento' },
                { kind: 'emoji', icon: Smile, label: 'Emoji' },
              ].map(item => (
                <button
                  key={item.kind}
                  type="button"
                  onClick={() => {
                    if (item.kind === 'emoji') {
                      setText(t => t + '🙂')
                    } else {
                      setPendingKind(item.kind)
                      fileInputRef.current?.click()
                    }
                    setShowMenu(false)
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <item.icon className="w-3.5 h-3.5 text-slate-400" />
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={placeholder || 'Escribe un mensaje...'}
          rows={1}
          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 resize-none text-sm leading-snug"
          style={{ minHeight: '32px', maxHeight: '120px' }}
        />
        <button
          type="submit"
          disabled={text.trim().length === 0}
          className="w-7 h-7 rounded-full bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-700 disabled:text-slate-500 text-white flex items-center justify-center flex-shrink-0 transition-colors self-end flex-none"
          aria-label="Enviar"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
      </div>
    </form>
  )
}
