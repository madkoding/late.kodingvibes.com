import { useState, useMemo } from 'react'
import type { ChannelMember } from '../../lib/chat/domain/types'
import { getNickColor } from '../../lib/irc/colors'
import Avatar from './Avatar'
import UserContextMenu, { useUserContextMenuState } from './UserContextMenu'
import { Shield, ShieldCheck } from 'lucide-react'

interface UserListProps {
  users: ChannelMember[]
  onBuzz?: (targetUserId: number) => void
  onCopyName?: (name: string) => void
}

export default function UserList({ users, onBuzz, onCopyName }: UserListProps) {
  const [query, setQuery] = useState('')
  const { menu: userMenu, setMenu: setUserMenu, close: closeUserMenu } = useUserContextMenuState()

  const sorted = useMemo(() => {
    return users.slice().sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1
      return a.display_name.toLowerCase().localeCompare(b.display_name.toLowerCase())
    })
  }, [users])

  const filtered = useMemo(() => {
    if (!query.trim()) return sorted
    const q = query.toLowerCase()
    return sorted.filter(u => u.display_name.toLowerCase().includes(q))
  }, [sorted, query])

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {users.length > 3 && (
        <div className="px-3 py-2 border-b border-slate-800">
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto py-1">
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-xs text-slate-500 text-center">
            {query ? 'Sin resultados' : 'No hay usuarios'}
          </div>
        )}
        {filtered.length > 0 && (
          <div>
            {filtered.map(u => (
              <div
                key={u.display_name}
                className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-800/60 transition-colors cursor-context-menu"
                onContextMenu={(e) => {
                  e.preventDefault()
                  setUserMenu({ show: true, x: e.clientX, y: e.clientY, user: u })
                }}
              >
                <div className="relative">
                  <Avatar nick={u.display_name} size="sm" />
                  {u.active && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900 animate-dot-pulse" />
                  )}
                </div>
                <span
                  className="text-sm truncate"
                  style={{ color: getNickColor(u.display_name) }}
                >
                  {u.display_name}
                </span>
                {u.role === 'admin' && (
                  <span title="Admin del canal">
                    <Shield className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  </span>
                )}
                {u.role === 'mod' && (
                  <span title="Moderador">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <UserContextMenu
        state={userMenu}
        onClose={closeUserMenu}
        onBuzz={(targetUserId) => onBuzz?.(targetUserId)}
        onCopyName={(name) => onCopyName?.(name)}
      />
    </div>
  )
}
