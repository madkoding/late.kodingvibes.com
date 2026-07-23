import { useEffect } from 'react'
import type { ChatMessage } from './chat/domain/types'

export interface ToastPayload {
  text: string
  type: 'mention' | 'join' | 'error'
  channelName?: string
}

export function formatToast(
  msg: ChatMessage,
  myUserId: number | null,
  myNick: string,
  channelName?: string,
): ToastPayload | null {
  if (!myUserId && !myNick) return null
  const mentioned = (msg.mentioned_user_ids ?? []).includes(myUserId ?? -1)
  let nickMatch = false
  if (!mentioned && myNick) {
    const escaped = myNick.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    nickMatch = new RegExp(`(^|\\s)@?${escaped}(?=\\b)`, 'i').test(msg.content)
  }
  if (mentioned || nickMatch) {
    const ch = channelName ? channelName.replace(/^#/, '') : null
    const where = ch ? ` en #${ch}` : ''
    if (msg.is_mass_mention) {
      const label = msg.content.toLowerCase().includes('@here') || msg.content.toLowerCase().includes('@aqui')
        ? 'mencionó a @here'
        : 'mencionó a @todos'
      return { text: `📢 ${msg.display_name} ${label}${where}`, type: 'mention', channelName: ch ?? undefined }
    }
    const preview = msg.content.length > 80 ? msg.content.slice(0, 77) + '…' : msg.content
    return { text: `${msg.display_name} te mencionó${where}: ${preview}`, type: 'mention', channelName: ch ?? undefined }
  }
  return null
}

export function showSystemNotification(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, {
      body, icon: '/android-chrome-192x192.png', badge: '/android-chrome-192x192.png',
      tag: `late-chat-${title}`, silent: false,
    })
    setTimeout(() => n.close(), 6000)
  } catch {}
}

export function useRequestNotificationPermission() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'default') {
      const t = setTimeout(() => { Notification.requestPermission().catch(() => {}) }, 8000)
      return () => clearTimeout(t)
    }
  }, [])
}
