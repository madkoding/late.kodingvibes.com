import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, within } from '@testing-library/react'
import ChannelList from './ChannelList'
import type { ChannelState, ChannelCategory } from '../../lib/chat/domain/types'

const category: ChannelCategory = {
  id: 1,
  server_id: 'srv',
  name: 'GENERAL',
  position: 0,
  is_collapsed: false,
  created_at: 0,
}

const textChannel: ChannelState = {
  id: 10,
  name: 'general',
  description: null,
  isPublic: true,
  channelType: 'text',
  categoryId: 1,
  position: 0,
  memberCount: 0,
  activeCount: 0,
  unread: 0,
  myRole: null,
  messages: [],
  joined: true,
}

const voiceChannel: ChannelState = {
  id: 20,
  name: 'voice-lounge',
  description: null,
  isPublic: true,
  channelType: 'voice',
  categoryId: 1,
  position: 1,
  memberCount: 0,
  activeCount: 0,
  voiceParticipants: 0,
  unread: 0,
  myRole: null,
  messages: [],
  joined: true,
}

function buildChannels(): Map<number, ChannelState> {
  const map = new Map<number, ChannelState>()
  map.set(textChannel.id, textChannel)
  map.set(voiceChannel.id, voiceChannel)
  return map
}

function baseProps() {
  return {
    channels: buildChannels(),
    categories: [category],
    currentChannel: null,
    activeVoiceChannelId: null,
    onSelect: vi.fn(),
    onJoin: vi.fn(),
    onVoiceJoin: vi.fn(),
    onVoiceLeave: vi.fn(),
    onCreateRequest: vi.fn(),
  }
}

describe('ChannelList', () => {
  it('fires onSelect with the channel name on single tap of a text channel row', () => {
    const props = baseProps()
    const { container } = render(<ChannelList {...props} />)
    fireEvent.click(within(container).getByText('general'))
    expect(props.onSelect).toHaveBeenCalledWith('general')
  })

  it('fires onVoiceJoin with the channel id on single tap of an inactive voice channel row', () => {
    const props = baseProps()
    const { container } = render(<ChannelList {...props} />)
    fireEvent.click(within(container).getByText('voice-lounge'))
    expect(props.onVoiceJoin).toHaveBeenCalledWith(voiceChannel.id)
  })

  it('channel row button uses cursor-pointer and select-none instead of cursor-context-menu', () => {
    const props = baseProps()
    const { container } = render(<ChannelList {...props} />)
    const button = within(container).getByText('general').closest('button')
    expect(button).not.toBeNull()
    expect(button?.className).toContain('cursor-pointer')
    expect(button?.className).toContain('select-none')
    expect(button?.className).not.toContain('cursor-context-menu')
  })
})
