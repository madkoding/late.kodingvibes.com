import { describe, it, expect, vi, beforeEach } from 'vitest'
import { formatToast, showSystemNotification, useRequestNotificationPermission } from './chat-notifs'
import { renderHook } from '@testing-library/react'

describe('chat-notifs', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  describe('formatToast', () => {
    const baseMsg = {
      id: 1,
      user_id: 2,
      display_name: 'Alice',
      content: 'hello @bob',
      channel_id: 1,
      mentioned_user_ids: [],
      is_mass_mention: false,
      created_at: '2024-01-01T00:00:00Z',
    }

    it('returns null when no myUserId and no myNick', () => {
      expect(formatToast(baseMsg as any, null, '')).toBeNull()
    })

    it('returns mention toast when nick matches via regex', () => {
      const result = formatToast(baseMsg as any, null, 'bob')
      expect(result).not.toBeNull()
      expect(result!.type).toBe('mention')
      expect(result!.text).toContain('Alice')
      expect(result!.text).toContain('te mencionó')
    })

    it('returns mass-mention toast for @here', () => {
      const msg = { ...baseMsg, content: '@here everyone', mentioned_user_ids: [1], is_mass_mention: true }
      const result = formatToast(msg as any, 1, 'bob')
      expect(result).not.toBeNull()
      expect(result!.text).toContain('@here')
    })

    it('returns mass-mention toast for @todos', () => {
      const msg = { ...baseMsg, content: '@todos everyone', mentioned_user_ids: [1], is_mass_mention: true }
      const result = formatToast(msg as any, 1, 'bob')
      expect(result).not.toBeNull()
      expect(result!.text).toContain('@todos')
    })

    it('returns null when no mention', () => {
      const msg = { ...baseMsg, content: 'just a message', mentioned_user_ids: [] }
      const result = formatToast(msg as any, 1, 'bob')
      expect(result).toBeNull()
    })

    it('includes channel name in mention toast when provided', () => {
      const result = formatToast(baseMsg as any, 1, 'bob', '#general')
      expect(result).not.toBeNull()
      expect(result!.text).toContain('en #general')
      expect(result!.channelName).toBe('general')
    })

    it('includes channel name in mass-mention toast', () => {
      const msg = { ...baseMsg, content: '@here everyone', mentioned_user_ids: [1], is_mass_mention: true }
      const result = formatToast(msg as any, 1, 'bob', '#sala')
      expect(result!.text).toContain('en #sala')
    })

    it('omits channel suffix when channelName is not provided', () => {
      const result = formatToast(baseMsg as any, null, 'bob')
      expect(result!.text).not.toContain(' en #')
    })
  })

  describe('showSystemNotification', () => {
    it('creates Notification when permission is granted', () => {
      const closeFn = vi.fn()
      const mockNotification = vi.fn(() => ({ close: closeFn }))
      const orig = globalThis.Notification
      globalThis.Notification = mockNotification as any
      ;(globalThis.Notification as any).permission = 'granted'
      showSystemNotification('title', 'body')
      expect(mockNotification).toHaveBeenCalledWith('title', expect.objectContaining({ body: 'body' }))
      globalThis.Notification = orig
    })
  })

  describe('useRequestNotificationPermission', () => {
    it('schedules setTimeout when permission is default', () => {
      const orig = globalThis.Notification
      globalThis.Notification = { permission: 'default', requestPermission: vi.fn() } as any
      const { unmount } = renderHook(() => useRequestNotificationPermission())
      expect(vi.getTimerCount()).toBe(1)
      unmount()
      globalThis.Notification = orig
    })
  })
})
