import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { Icecast } from './IcecastPage'

const mockPlay = vi.fn()

vi.mock('@/audio/AudioProvider', () => ({
  useAudio: () => ({
    current: null,
    playing: false,
    play: mockPlay,
  }),
}))

vi.mock('@/lib/use-document-title', () => ({
  default: vi.fn(),
}))

vi.mock('@/audio/MiniPlayer', () => ({
  default: () => null,
}))

vi.mock('./useIcecastStatus', () => ({
  useIcecastStatus: () => ({
    mounts: [
      { name: 'groovesalad', display_name: 'Groovesalad', stream_url: 'https://example.com/groovesalad', listeners: 10, current_track: 'Track', current_artist: 'Artist', audio_info: null, is_active: true },
    ],
    totalListeners: 10,
    isLoading: false,
  }),
}))

vi.mock('./MountCard', () => ({
  MountCard: ({ mount }: any) => <div data-testid="mount-card">{mount.display_name}</div>,
}))

vi.mock('@/components/Layout', () => ({
  Layout: ({ children }: any) => <div>{children}</div>,
}))

describe('IcecastPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    const { container } = render(<Icecast />)
    expect(container).toBeDefined()
  })

  it('shows mount cards', () => {
    const { getAllByText } = render(<Icecast />)
    expect(getAllByText('Groovesalad').length).toBeGreaterThan(0)
  })
})
