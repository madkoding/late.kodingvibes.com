import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage } from '../../lib/irc/types'
import { getEmoji } from '../../lib/emoji'
import { SmilePlus, Bell, Copy, MessageSquareReply, CornerUpRight, EyeOff, Trash2, Hash } from 'lucide-react'

function EmojiIcon({ name, size = 20 }: { name: string; size?: number }) {
  const def = getEmoji(name)
  if (!def) return null
  const html = def.svg.replace(/^<svg /, `<svg width="${size}" height="${size}" `)
  return (
    <span className="inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export interface ContextMenuState {
  show: boolean
  x: number
  y: number
  message: ChatMessage | null
  isOwn: boolean
}

interface MessageContextMenuProps {
  state: ContextMenuState
  onClose: () => void
  onReact: (messageId: number, emoji: string) => void
  onReply: (message: ChatMessage) => void
  onBuzz: (targetUserId: number) => void
  onCopyText: (text: string) => void
  onForward: (message: ChatMessage) => void
  myRole?: string | null
  onHide?: (messageId: number) => void
  onDelete?: (messageId: number) => void
}

const quickEmojis = ['heart', 'thumbsup', 'thumbsdown', 'laugh', 'smile', 'point', 'cry', 'serious', 'angry', 'fire', 'star', 'sparkles', 'rocket', 'check']

export default function MessageContextMenu({
  state, onClose, onReact, onReply, onBuzz, onCopyText, onForward, myRole, onHide, onDelete,
}: MessageContextMenuProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const isAdmin = myRole === 'admin' || myRole === 'mod'
  const ref = useRef<HTMLDivElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!state.show) return
    setShowEmojiPicker(false)
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [state.show, onClose])

  if (!state.show || !state.message) return null

  const { message, isOwn, x, y } = state
  const menuW = 200
  const menuH = isOwn ? 160 : 210
  const vpW = window.innerWidth
  const vpH = window.innerHeight
  const adjustedX = Math.min(x, vpW - menuW - 8)
  const adjustedY = Math.min(y, vpH - menuH - 8)

  return (
    <div
      ref={ref}
      className="fixed z-[250] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 min-w-[180px] overflow-hidden select-none"
      style={{ left: adjustedX, top: adjustedY }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => {
          setShowEmojiPicker(v => !v)
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
      >
        <SmilePlus className="w-4 h-4 text-indigo-400" />
        Reaccionar
        <span className="ml-auto text-[10px] text-slate-500">{showEmojiPicker ? '▲' : '▼'}</span>
      </button>
      {showEmojiPicker && (
        <div ref={emojiRef} className="grid grid-cols-5 gap-1.5 px-3 py-2 bg-slate-950 border-t border-slate-800">
          {quickEmojis.map(name => (
            <button
              key={name}
              type="button"
              onClick={() => {
                onReact(message.id, name)
                onClose()
              }}
              className="aspect-square min-w-[44px] rounded-lg hover:bg-slate-800 flex items-center justify-center transition-colors active:scale-95"
              title={name}
            >
              <EmojiIcon name={name} size={22} />
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          onReply(message)
          onClose()
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
      >
        <MessageSquareReply className="w-4 h-4 text-cyan-400" />
        Responder
      </button>
      <button
        type="button"
        onClick={() => {
          onForward(message)
          onClose()
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
      >
        <CornerUpRight className="w-4 h-4 text-cyan-400" />
        Reenviar
      </button>
      {!isOwn && (
        <button
          type="button"
          onClick={() => {
            onBuzz(message.user_id)
            onClose()
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <Bell className="w-4 h-4 text-amber-400" />
          Zumbido
        </button>
      )}
      {isAdmin && (
        <>
          <div className="h-px bg-slate-800 my-1" />
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(String(message.id)).catch(() => {})
              onClose()
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <Hash className="w-4 h-4 text-slate-400" />
            Copiar ID
          </button>
          <button
            type="button"
            onClick={() => {
              onHide?.(message.id)
              onClose()
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <EyeOff className="w-4 h-4 text-amber-400" />
            Ocultar
          </button>
          <button
            type="button"
            onClick={() => {
              onDelete?.(message.id)
              onClose()
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:bg-slate-800 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
            Eliminar
          </button>
        </>
      )}
      <button
        type="button"
        onClick={() => {
          onCopyText(message.content)
          onClose()
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
      >
        <Copy className="w-4 h-4 text-slate-400" />
        Copiar texto
      </button>
    </div>
  )
}

export function useContextMenuState() {
  const [menu, setMenu] = useState<ContextMenuState>({
    show: false, x: 0, y: 0, message: null, isOwn: false,
  })

  const close = useCallback(() => {
    setMenu(prev => ({ ...prev, show: false }))
  }, [])

  return { menu, setMenu, close }
}
