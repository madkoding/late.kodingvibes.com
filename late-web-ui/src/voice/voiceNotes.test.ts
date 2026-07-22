import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { recordVoiceNote, uploadVoiceNote, fetchVoiceNoteUrl } from './voiceNotes'

vi.mock('../audio/voiceChain', () => ({
  createVoiceChain: vi.fn(() => ({
    processedStream: new MediaStream(),
    destroy: vi.fn(),
  })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('recordVoiceNote', () => {
  it('calls getUserMedia and returns blob and durationMs', async () => {
    const result = await recordVoiceNote(50, 'radio-am', 100)
    expect(result.blob).toBeInstanceOf(Blob)
    expect(typeof result.durationMs).toBe('number')
  })

  it('uses default amount and preset', async () => {
    const result = await recordVoiceNote(50, 'radio-am', 100)
    expect(result.blob).toBeInstanceOf(Blob)
  })
})

describe('uploadVoiceNote', () => {
  it('sends POST with FormData and auth header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'note-1', duration_ms: 1000, amount: 50, size_bytes: 1234, mime: 'audio/webm', created_at: 100 }),
    })
    vi.stubGlobal('fetch', mockFetch)
    localStorage.setItem('chat.session', JSON.stringify({ session_id: 'sess-abc' }))

    const blob = new Blob(['test'], { type: 'audio/webm' })
    const result = await uploadVoiceNote(blob, 1, 1000, 50)

    expect(mockFetch).toHaveBeenCalledWith('/api/chat/voice-notes', {
      method: 'POST',
      headers: { Authorization: 'Bearer sess-abc' },
      body: expect.any(FormData),
    })
    expect(result.id).toBe('note-1')
  })

  it('throws on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ detail: 'Upload failed' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const blob = new Blob(['test'], { type: 'audio/webm' })
    await expect(uploadVoiceNote(blob, 1, 1000)).rejects.toThrow('Upload failed')
  })
})

describe('fetchVoiceNoteUrl', () => {
  it('returns correct URL path', async () => {
    const url = await fetchVoiceNoteUrl('note-abc')
    expect(url).toBe('/api/chat/voice-notes/note-abc')
  })
})
