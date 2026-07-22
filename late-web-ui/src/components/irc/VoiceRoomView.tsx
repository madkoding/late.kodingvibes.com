import { useState, useRef, useCallback, useEffect } from 'react'
import { MessageSquare } from 'lucide-react'
import ParticipantTile from './ParticipantTile'
import MessageInput from './MessageInput'
import MessageList from './MessageList'
import TypingIndicator from './TypingIndicator'
import { useVoiceRoom } from '../../voice/useVoiceRoom'
import { recordVoiceNote, uploadVoiceNote } from '../../voice/voiceNotes'
import type { ChannelState, ChatMessage } from '../../lib/irc/types'

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
  onLeave: () => void
  onSendMessage: (channelId: number, content: string) => void
  onSearchUsers?: (q: string) => Promise<any[]>
  onInviteUser?: (channelId: number, email: string) => Promise<any>
  onInviteConfirm?: (user: any) => void
}

export default function VoiceRoomView({
  channel, myUserId, myRole, nick, nickMap,
  sendViaWs, onVoiceMessage, onLeave,   onSendMessage,
  onSearchUsers,
  onInviteUser,
  onInviteConfirm,
}: VoiceRoomViewProps) {
  const [micOn, setMicOn] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [amount, setAmount] = useState(50)
  const [recording, setRecording] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const [replyContext, setReplyContext] = useState<ChatMessage | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)

  const voiceRoom = useVoiceRoom(sendViaWs, localStream, onVoiceMessage)

  const peerVolumes = useRef<Map<number, number>>(new Map())
  const peerMuted = useRef<Map<number, boolean>>(new Map())

  useEffect(() => {
    voiceRoom.joinRoom(String(channel.id))
    return () => voiceRoom.leaveRoom(String(channel.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id])

  const toggleMic = useCallback(async () => {
    if (micOn) {
      micStreamRef.current?.getTracks().forEach(t => t.stop())
      setLocalStream(null)
      micStreamRef.current = null
      setMicOn(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        micStreamRef.current = stream
        setLocalStream(stream)
        setMicOn(true)
      } catch {
        // permission denied or no mic
      }
    }
  }, [micOn])

  const startRecording = useCallback(async () => {
    setRecording(true)
    try {
      const { blob, durationMs } = await recordVoiceNote(amount)
      setRecording(false)
      if (durationMs < 500) return
      const note = await uploadVoiceNote(blob, channel.id, durationMs, amount)
      onSendMessage(channel.id, `__late_voicenote__:${note.id}`)
    } catch {
      setRecording(false)
    }
  }, [channel.id, amount, onSendMessage])

  useEffect(() => {
    return () => {
      micStreamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const peers: PeerState[] = voiceRoom.peers
  const totalConnected = peers.length + (micOn ? 1 : 0)

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
      </div>

      {/* Participant grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* Self tile */}
          <ParticipantTile
            userId={myUserId ?? 0}
            displayName={nick}
            stream={localStream}
            isSelf
            micOn={micOn}
            speaking={micOn && voiceRoom.peers.length > 0}
            isAdmin={false}
            volume={100}
            locallyMuted={false}
            onVolumeChange={() => {}}  // ponytail: self-tile, no volume control needed
            onLocalMuteToggle={() => {}}  // ponytail: self-tile, mute handled by mic toggle
            onMicToggle={toggleMic}
            onAmountChange={setAmount}
            amount={amount}
            onRecord={startRecording}
            recording={recording}
            onLeave={onLeave}
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
        {/* Empty state hint */}
        {!micOn && (
          <div className="flex items-center justify-center pt-8">
            <div className="text-center">
              <p className="text-sm text-slate-500">
                Activa el micrófono para hablar con {' '}
                {peers.length > 0 ? `${peers.length} persona${peers.length !== 1 ? 's' : ''}` : 'otros'}
              </p>
              <button
                onClick={toggleMic}
                className="mt-3 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium transition-colors"
              >
                Activar micrófono
              </button>
            </div>
          </div>
        )}
        {peers.length === 0 && micOn && (
          <div className="flex items-center justify-center pt-6">
            <p className="text-xs text-slate-500">
              Esperando a que alguien se conecte...
            </p>
          </div>
        )}
      </div>

      {/* Input toggle + text area */}
      {showInput && (
        <div className="border-t border-slate-800 flex-shrink-0">
          <div className="max-h-48 overflow-y-auto">
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
          <MessageInput
            onSend={handleSend}
            disabled={false}
            placeholder={`Mensaje en ${channel.name}`}
            channelMembers={channel.members || []}
            channelId={channel.id}
            replyContext={replyContext}
            onClearReply={() => setReplyContext(null)}
            onError={() => {}}
            onSearchUsers={onSearchUsers || (async () => [])}
            onInviteUser={onInviteUser || (async () => ({ ok: false }))}
            onInviteConfirm={onInviteConfirm || (() => {})}
          />
        </div>
      )}

      {/* Message toggle button */}
      <div className="flex items-center justify-center border-t border-slate-800 px-4 py-2">
        <button
          onClick={() => setShowInput(!showInput)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            showInput
              ? 'bg-indigo-500/15 text-indigo-300'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {showInput ? 'Cerrar chat de texto' : 'Mensaje'}
        </button>
      </div>
    </div>
  )
}
