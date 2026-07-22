import { Hash, Users, Settings as SettingsIcon, Menu } from 'lucide-react'
import ConnectionStatus from '@/components/irc/ConnectionStatus'
import type { ChannelState } from '@/lib/chat/domain/types'

interface TopbarProps {
  currentChan: ChannelState | undefined
  userCount: number
  nick: string
  connected: boolean
  showUsersDrawer: boolean
  onToggleUsers: () => void
  onOpenSettings: () => void
  onOpenChannels: () => void
  onChangeNick: () => void
}

export function Topbar({ currentChan, userCount, nick, connected, showUsersDrawer, onToggleUsers, onOpenSettings, onOpenChannels, onChangeNick }: TopbarProps) {
  return (
    <>
      <div className="hidden sm:flex flex-shrink-0 bg-slate-900/60 border-b border-slate-800 px-3 sm:px-4 h-10 items-center justify-between z-20">
        <div className="flex items-center gap-2 min-w-0">
          <Hash className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <h1 className="font-semibold text-slate-100 text-sm sm:text-base truncate">
            {currentChan?.name?.slice(1) || 'chat'}
          </h1>
          {currentChan?.description && (
            <span className="text-xs text-slate-500 truncate max-w-[240px] hidden lg:inline">
              · {currentChan.description}
            </span>
          )}
          {userCount > 0 && (
            <span className="text-xs text-slate-500 flex-shrink-0 hidden lg:inline">
              · {userCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Notificaciones"
            title="Notificaciones"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
          <ConnectionStatus connected={connected} nick={nick} onChangeNick={onChangeNick} />
          <button
            onClick={onToggleUsers}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors ${
              showUsersDrawer
                ? 'bg-indigo-500/15 text-indigo-300'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            aria-label="Ver usuarios"
          >
            <Users className="w-4 h-4" />
            <span className="text-xs tabular-nums">{userCount}</span>
          </button>
        </div>
      </div>

      <div className="sm:hidden flex-shrink-0 bg-slate-900/60 border-b border-slate-800 px-3 h-10 flex items-center justify-between z-20">
        <button
          onClick={onOpenChannels}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
          aria-label="Abrir canales"
        >
          <Menu className="w-5 h-5" />
        </button>
        <button
          onClick={onChangeNick}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          aria-label="Cambiar nick"
          title="Cambiar nick"
        >
          <span className="text-xs font-mono text-slate-300 truncate max-w-[80px]">{nick}</span>
        </button>
        <div className="flex items-center gap-1.5 min-w-0">
          <Hash className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <span className="font-semibold text-slate-100 text-sm truncate">
            {currentChan?.name?.slice(1) || 'chat'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Notificaciones"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleUsers}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors ${
              showUsersDrawer
                ? 'bg-indigo-500/15 text-indigo-300'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            aria-label="Ver usuarios"
          >
            <Users className="w-4 h-4" />
            <span className="text-xs tabular-nums">{userCount}</span>
          </button>
        </div>
      </div>
    </>
  )
}
