import { useState, useRef, useEffect, useCallback } from 'react'
import { Copy, LogOut, Users } from 'lucide-react'

export interface ChannelContextMenuState {
  show: boolean
  x: number
  y: number
  channel: { id?: number; name: string; description?: string | null; joined?: boolean; myRole?: string | null } | null
}

interface ChannelContextMenuProps {
  state: ChannelContextMenuState
  onClose: () => void
  onCopyName: (name: string) => void
  onLeave?: (channelId: number) => void
  onManageMembers?: (channelId: number) => void
}

export default function ChannelContextMenu({
  state, onClose, onCopyName, onLeave, onManageMembers,
}: ChannelContextMenuProps) {
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

  if (!state.show || !state.channel) return null

  const { channel, x, y } = state
  const menuW = 200
  const menuH = 160
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
      {channel.description && (
        <div className="px-3 py-2 text-xs text-slate-400 border-b border-slate-800 max-w-[220px]">
          <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider block mb-0.5">Descripción</span>
          <p className="break-words leading-snug">{channel.description}</p>
        </div>
      )}
      <button
        type="button"
        onClick={() => { onCopyName(channel.name); onClose() }}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
      >
        <Copy className="w-4 h-4 text-slate-400" />
        Copiar nombre
      </button>
      {channel.joined && channel.id !== undefined && channel.myRole && ['admin', 'mod'].includes(channel.myRole) && (
        <button
          type="button"
          onClick={() => { onManageMembers?.(channel.id as number); onClose() }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <Users className="w-4 h-4 text-indigo-400" />
          Administrar miembros
        </button>
      )}
      {channel.joined && channel.id !== undefined && (
        <button
          type="button"
          onClick={() => { onLeave?.(channel.id as number); onClose() }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-rose-400 hover:bg-slate-800 transition-colors"
        >
          <LogOut className="w-4 h-4 text-rose-400" />
          Salir del canal
        </button>
      )}
    </div>
  )
}

export function useChannelContextMenuState() {
  const [menu, setMenu] = useState<ChannelContextMenuState>({
    show: false, x: 0, y: 0, channel: null,
  })

  const close = useCallback(() => {
    setMenu(prev => ({ ...prev, show: false }))
  }, [])

  return { menu, setMenu, close }
}
