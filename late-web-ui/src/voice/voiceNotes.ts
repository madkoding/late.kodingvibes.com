import { createVoiceChain } from '../audio/voiceChain'
import type { PresetName } from '../audio/presets'

export interface VoiceNoteResult {
  id: string
  duration_ms: number
  amount: number
  size_bytes: number
  mime: string
  created_at: number
}

export async function recordVoiceNote(
  amount = 50,
  presetName: PresetName = 'radio-am',
  maxDurationMs = 30_000,
): Promise<{ blob: Blob; durationMs: number }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

  const chain = createVoiceChain(stream, presetName, amount)
  const processedStream = chain.processedStream

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm'

  const recorder = new MediaRecorder(processedStream, { mimeType })
  const chunks: BlobPart[] = []

  const startTime = performance.now()
  let stopped = false

  return new Promise((resolve, reject) => {
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    recorder.onstop = () => {
      chain.destroy()
      stream.getTracks().forEach(t => t.stop())
      const elapsed = performance.now() - startTime
      const blob = new Blob(chunks, { type: mimeType })
      resolve({ blob, durationMs: Math.round(elapsed) })
    }

    recorder.onerror = () => {
      chain.destroy()
      stream.getTracks().forEach(t => t.stop())
      reject(new Error('Recording failed'))
    }

    recorder.start(50)

    setTimeout(() => {
      if (!stopped && recorder.state === 'recording') {
        stopped = true
        recorder.stop()
      }
    }, maxDurationMs)
  })
}

export async function uploadVoiceNote(
  blob: Blob,
  channelId: number,
  durationMs: number,
  amount = 50,
): Promise<VoiceNoteResult> {
  const form = new FormData()
  form.append('file', blob, 'voice.webm')
  form.append('channel_id', String(channelId))
  form.append('duration_ms', String(durationMs))
  form.append('amount', String(amount))

  const res = await fetch('/api/chat/voice-notes', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('chat.session') ? JSON.parse(localStorage.getItem('chat.session')!).session_id : ''}`,
    },
    body: form,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail || 'Failed to upload voice note')
  }

  return res.json()
}

export async function fetchVoiceNoteUrl(noteId: string): Promise<string> {
  return `/api/chat/voice-notes/${noteId}`
}
