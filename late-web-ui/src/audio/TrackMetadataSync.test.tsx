import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { TrackMetadataSync } from './TrackMetadataSync'

const mockSetTrack = vi.fn()
const mockAudio = {
  current: { mount: 'groovesalad' },
  setTrack: mockSetTrack,
}

vi.mock('./AudioProvider', () => ({
  useAudio: () => mockAudio,
}))

describe('TrackMetadataSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    globalThis.fetch = vi.fn()
  })

  it('renders null', () => {
    const { container } = render(<TrackMetadataSync />)
    expect(container.innerHTML).toBe('')
  })

  it('fetches /status-json.xsl', () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ icestats: { source: [] } }),
    } as any)
    render(<TrackMetadataSync />)
    expect(fetch).toHaveBeenCalledWith('/status-json.xsl', { cache: 'no-store' })
  })

  it('parses mount metadata and sets track', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        icestats: {
          source: [{ listenurl: '/groovesalad', title: 'Artist - Track' }],
        },
      }),
    } as any)
    render(<TrackMetadataSync />)
    await vi.advanceTimersByTimeAsync(0)
    expect(mockSetTrack).toHaveBeenCalledWith({
      artist: 'Artist',
      title: 'Track',
      raw: 'Artist - Track',
    })
  })
})
