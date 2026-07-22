import { useEffect, useState } from 'react'
import AudioWaveform from './AudioWaveform'

interface VoiceNoteData {
  id: string
  user_id: number
  channel_id: number
  duration_ms: number
  amount: number
  size_bytes: number
  mime: string
  display_name?: string
  created_at: number
}

interface VoiceNotePlayerProps {
  noteId: string
}

export default function VoiceNotePlayer({ noteId }: VoiceNotePlayerProps) {
  const [note, setNote] = useState<VoiceNoteData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/chat/voice-notes/${noteId}/meta`)
      .then(r => r.json())
      .then(d => setNote(d))
      .catch(() => setError('Could not load voice note'))
  }, [noteId])

  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/50 text-slate-500 text-xs">
        {error}
      </div>
    )
  }

  if (!note) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/50 text-slate-500 text-xs">
        <div className="w-4 h-4 border border-slate-500 border-t-transparent rounded-full animate-spin" />
        Loading...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 min-w-[260px]">
      <AudioWaveform src={`/api/chat/voice-notes/${noteId}`} />
      <div className="flex items-center gap-2 px-1">
        <span className="text-[10px] text-indigo-400 font-medium bg-indigo-500/10 px-1.5 py-0.5 rounded-full">
          Radio/AM
        </span>
        {note.amount > 0 && (
          <span className="text-[10px] text-slate-500">
            Amount: {note.amount}
          </span>
        )}
        <span className="text-[10px] text-slate-500 ml-auto">
          {(note.duration_ms / 1000).toFixed(1)}s
        </span>
      </div>
    </div>
  )
}
