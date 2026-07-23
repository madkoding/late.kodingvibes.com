import { useRef, useEffect, useState } from 'react'
import { Mic, MicOff, Volume2, VolumeX, ShieldX } from 'lucide-react'
import { useAudioLevel } from '../../hooks/useAudioLevel'
import SpectrumAnalyzer from './SpectrumAnalyzer'

interface ParticipantTileProps {
  userId: number
  displayName: string
  stream: MediaStream | null
  isSelf: boolean
  micOn: boolean
  speaking: boolean
  isAdmin: boolean
  volume: number
  locallyMuted: boolean
  onVolumeChange: (vol: number) => void
  onLocalMuteToggle: () => void
  onKick?: () => void
  onMicToggle?: () => void
  onAmountChange?: (amount: number) => void
  amount?: number
  onRecord?: () => void
  recording?: boolean
}

export default function ParticipantTile({
  userId, displayName, stream, isSelf,
  micOn, speaking, isAdmin,
  volume, locallyMuted,
  onVolumeChange, onLocalMuteToggle, onKick,
  onMicToggle, onAmountChange, amount, onRecord, recording,
}: ParticipantTileProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [showVolume, setShowVolume] = useState(false)
  const level = useAudioLevel(isSelf ? (micOn ? stream : null) : (speaking ? stream : null))
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    if (!stream || isSelf) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.srcObject = null
        audioRef.current = null
      }
      return
    }
    if (!audioRef.current) {
      const audio = new Audio()
      audio.autoplay = true
      audioRef.current = audio
    }
    audioRef.current.srcObject = stream
    audioRef.current.play().catch(() => {})
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.srcObject = null
      }
    }
  }, [stream, isSelf])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = locallyMuted ? 0 : (volume / 100)
    }
  }, [volume, locallyMuted])

  const initial = displayName.charAt(0).toUpperCase()
  const hue = (userId * 37) % 360

  return (
    <div
      className={`relative flex flex-col items-center gap-2 rounded-xl p-3 transition-all duration-150 ${
        speaking && !locallyMuted
          ? 'bg-emerald-500/10 ring-2 ring-emerald-400/60'
          : 'bg-slate-800/60 ring-1 ring-slate-700/50'
      }`}
    >
      {/* Avatar */}
      <div className="relative">
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white select-none transition-shadow ${
            speaking && !locallyMuted ? 'shadow-lg shadow-emerald-400/20' : ''
          }`}
          style={{ backgroundColor: `hsl(${hue}, 55%, 45%)` }}
        >
          {imgError ? initial : (
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=transparent&color=fff&size=56&bold=true`}
              alt=""
              className="w-full h-full rounded-full object-cover"
              onError={() => setImgError(true)}
            />
          )}
          {imgError && <span>{initial}</span>}
        </div>
        {/* Speaking indicator */}
        {!locallyMuted && (
          <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
            {micOn && speaking && Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="w-1 bg-emerald-400 rounded-full animate-pulse"
                style={{
                  height: `${4 + level * 16 * (0.5 + i * 0.25)}px`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        )}
        {/* Mute badge */}
        {locallyMuted && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center">
            <VolumeX className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* Spectrum analyzer */}
      <SpectrumAnalyzer
        stream={micOn || !isSelf ? stream : null}
        active={micOn || !isSelf}
        barCount={12}
        className="w-full max-w-[80px]"
      />

      {/* Name */}
      <div className="flex flex-col items-center min-w-0 max-w-full">
        <span className="text-xs font-medium text-slate-200 truncate max-w-[90px]">
          {displayName}
        </span>
      </div>

      {/* Self controls */}
      {isSelf && (
        <div className="flex flex-col items-center gap-1.5 w-full mt-1">
          {onMicToggle && (
            <button
              onClick={onMicToggle}
              className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                micOn ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title={micOn ? 'Silenciar micrófono' : 'Activar micrófono'}
            >
              {micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            </button>
          )}
          {onAmountChange && amount !== undefined && (
            <div className="flex items-center gap-1.5 w-full px-1">
              <label className="text-[8px] text-slate-500 whitespace-nowrap">Amount</label>
              <input
                type="range"
                min="0" max="100"
                value={amount}
                onChange={e => onAmountChange(Number(e.target.value))}
                className="w-full h-1 accent-indigo-500"
              />
              <span className="text-[9px] text-slate-500 tabular-nums w-4 text-right">{amount}</span>
            </div>
          )}
          {onRecord && (
            <button
              onMouseDown={onRecord}
              disabled={recording}
              className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                recording ? 'bg-red-500/20 text-red-300 animate-pulse' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title={recording ? 'Grabando...' : 'Mantener para nota de voz'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="6" />
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Peer controls */}
      {!isSelf && (
        <div className="flex items-center gap-1 mt-1">
          {/* Volume control */}
          <div
            className="relative"
            onMouseEnter={() => setShowVolume(true)}
            onMouseLeave={() => setShowVolume(false)}
          >
            <button
              onClick={() => {
                if (locallyMuted) onLocalMuteToggle()
                else setShowVolume(!showVolume)
              }}
              className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
                locallyMuted ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title={locallyMuted ? 'Activar audio' : 'Ajustar volumen'}
            >
              {locallyMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
            </button>
            {showVolume && !locallyMuted && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 border border-slate-700 rounded-lg p-2 shadow-xl z-50 flex flex-col items-center gap-1">
                <span className="text-[8px] text-slate-500">Vol.</span>
                <input
                  type="range"
                  min="0" max="100"
                  value={volume}
                  onChange={e => onVolumeChange(Number(e.target.value))}
                  className="w-16 h-1 accent-indigo-500 rotate-0"
                  style={{ writingMode: 'horizontal-tb' }}
                />
                <span className="text-[9px] text-slate-500 tabular-nums">{volume}</span>
              </div>
            )}
          </div>

          {/* Local mute toggle */}
          <button
            onClick={onLocalMuteToggle}
            className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
              locallyMuted ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title={locallyMuted ? 'Reactivar audio' : 'Silenciar localmente'}
          >
            {locallyMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          </button>

          {/* Kick (admin only) */}
          {isAdmin && onKick && (
            <button
              onClick={onKick}
              className="flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
              title="Expulsar del canal de voz"
            >
              <ShieldX className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
