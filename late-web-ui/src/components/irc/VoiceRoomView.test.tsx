import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import VoiceRoomView from './VoiceRoomView'

vi.mock('../../voice/useVoiceRoom', () => ({
  useVoiceRoom: () => ({ peers: [], joinRoom: vi.fn(), leaveRoom: vi.fn() }),
}))

vi.mock('../../hooks/useAudioLevel', () => ({
  useAudioLevel: () => 0,
}))

vi.mock('../../voice/audioContext', () => ({
  getOrCreateAudioContext: () => ({
    createMediaStreamSource: vi.fn(),
    createGain: () => ({ gain: {}, connect: vi.fn() }),
    createMediaStreamDestination: () => ({ stream: null }),
    currentTime: 0,
  }),
  resumeAudioContext: () => Promise.resolve(),
}))

vi.mock('./ParticipantTile', () => ({ default: () => null }))
vi.mock('./MessageList', () => ({ default: () => null }))
vi.mock('./TypingIndicator', () => ({ default: () => null }))

const channel = {
  id: 1,
  name: '🔊 General',
  messages: [],
  members: [],
  myRole: null,
} as any

describe('VoiceRoomView', () => {
  beforeEach(() => {
    // navigator.mediaDevices is already defined (non-configurable) by the
    // test setup, so reassign getUserMedia directly instead of redefining
    // the property.
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error('no mic'))
  })

  it('renders a Salir button that calls onLeave when clicked', () => {
    const onLeave = vi.fn()
    const { getByLabelText } = render(
      <VoiceRoomView
        channel={channel}
        myUserId={1}
        myRole={null}
        nick="tester"
        nickMap={new Map()}
        sendViaWs={vi.fn()}
        onVoiceMessage={() => () => {}}
        onSendMessage={vi.fn()}
        onLeave={onLeave}
      />,
    )
    const leaveButton = getByLabelText('Salir de la sala de voz')
    expect(leaveButton).toBeDefined()
    fireEvent.click(leaveButton)
    expect(onLeave).toHaveBeenCalledTimes(1)
  })
})
