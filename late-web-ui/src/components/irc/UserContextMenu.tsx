import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChannelMember } from '../../lib/chat/domain/types'
import { Bell, Copy } from 'lucide-react'

export interface UserContextMenuState {
  show: boolean
  x: number
  y: number
  user: ChannelMember | null
}

interface UserContextMenuProps {
  state: UserContextMenuState
  onClose: () => void
  onBuzz: (targetUserId: number) => void
  onCopyName: (name: string) => void
}

export default function UserContextMenu({
  state, onClose, onBuzz, onCopyName,
}: UserContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!state.show) return
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

  if (!state.show || !state.user) return null

  const { user, x, y } = state
  const menuW = 180
  const menuH = 100
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
          onBuzz(user.id)
          onClose()
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
      >
        <Bell className="w-4 h-4 text-amber-400" />
        Zumbido
      </button>
      <button
        type="button"
        onClick={() => {
          onCopyName(user.display_name)
          onClose()
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
      >
        <Copy className="w-4 h-4 text-slate-400" />
        Copiar nombre
      </button>
    </div>
  )
}

export function useUserContextMenuState() {
  const [menu, setMenu] = useState<UserContextMenuState>({
    show: false, x: 0, y: 0, user: null,
  })

  const close = useCallback(() => {
    setMenu(prev => ({ ...prev, show: false }))
  }, [])

  return { menu, setMenu, close }
}
