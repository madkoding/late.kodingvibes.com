import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { Irc } from './IrcPage'

vi.mock('@/lib/irc/chat-client', () => ({
  ChatClient: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    onState: vi.fn(),
    onMessage: vi.fn(),
    onTyping: vi.fn(),
    onBuzz: vi.fn(),
    onMemberMuted: vi.fn(),
    onAuthFatal: vi.fn(),
    onVoiceMessage: vi.fn(),
    listCategories: vi.fn().mockResolvedValue([]),
    channels: new Map(),
    nickByUserId: new Map(),
    setCurrentChannel: vi.fn(),
    loadMembers: vi.fn(),
    refreshChannels: vi.fn(),
    reloadCurrentChannelHistory: vi.fn(),
    sendRaw: vi.fn(),
    sendMessage: vi.fn(),
    updateMe: vi.fn(),
    loadHistory: vi.fn(),
    toggleReaction: vi.fn(),
    forwardMessage: vi.fn(),
    buzz: vi.fn(),
    api: vi.fn(),
    joinChannel: vi.fn(),
    uploadAttachment: vi.fn(),
    getCurrentChannel: vi.fn().mockReturnValue(null),
  })),
}))

vi.mock('@/audio/AudioProvider', () => ({
  useAudio: () => ({
    current: null,
    playing: false,
    play: vi.fn(),
    toggle: vi.fn(),
    stop: vi.fn(),
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
    getAudioElement: vi.fn(),
    getAnalyser: vi.fn(),
  }),
}))

vi.mock('@/lib/use-document-title', () => ({
  default: vi.fn(),
}))

vi.mock('@/lib/use-header-offset', () => ({
  useHeaderOffset: () => ({ headerHeight: 0, vh: 0 }),
}))

vi.mock('@/lib/notification-sound', () => ({
  ensureNotificationAudio: vi.fn(),
  playMentionBeep: vi.fn(),
  playBuzz: vi.fn(),
  setVolume: vi.fn(),
}))

vi.mock('@/lib/chat-notifs', () => ({
  formatToast: vi.fn(),
  showSystemNotification: vi.fn(),
  useRequestNotificationPermission: vi.fn(),
}))

vi.mock('@/audio/MiniPlayer', () => ({
  default: () => null,
}))

vi.mock('@/components/irc/ChannelList', () => ({
  default: () => null,
}))

vi.mock('@/components/irc/UserList', () => ({
  default: () => null,
}))

vi.mock('@/components/irc/MessageList', () => ({
  default: () => null,
}))

vi.mock('@/components/irc/MessageInput', () => ({
  default: () => null,
}))

vi.mock('@/components/irc/TypingIndicator', () => ({
  default: () => null,
}))

vi.mock('@/components/irc/JoinChannelModal', () => ({
  default: () => null,
}))

vi.mock('@/components/irc/NickPromptModal', () => ({
  default: () => null,
}))

vi.mock('@/components/irc/NotificationSettingsModal', () => ({
  default: () => null,
}))

vi.mock('@/components/irc/ManageMembersModal', () => ({
  default: () => null,
}))

vi.mock('@/components/irc/ForwardModal', () => ({
  default: () => null,
}))

vi.mock('@/components/irc/Drawer', () => ({
  default: ({ children }: any) => children || null,
}))

vi.mock('@/components/irc/FloatingVideo', () => ({
  default: () => null,
}))

vi.mock('@/components/irc/VoiceRoomView', () => ({
  default: () => null,
}))

vi.mock('./Topbar', () => ({
  Topbar: () => null,
}))

describe('IrcPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('renders without crashing', () => {
    const { container } = render(<Irc />)
    expect(container).toBeDefined()
  })
})
