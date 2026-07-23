import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import MiniPlayer from './MiniPlayer'

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}))

vi.mock('./AudioProvider', () => ({
  useAudio: () => ({
    current: null,
    track: null,
    setTrack: vi.fn(),
    playing: false,
    loading: false,
    volume: 0.7,
    muted: false,
    play: vi.fn(),
    toggle: vi.fn(),
    stop: vi.fn(),
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
    getAudioElement: vi.fn(() => null),
    getAnalyser: vi.fn(() => null),
  }),
}))

describe('MiniPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders null when no current stream', () => {
    const { container } = render(<MiniPlayer />)
    expect(container.innerHTML).toBe('')
  })
})
