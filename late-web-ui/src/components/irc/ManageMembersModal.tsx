import { useState, useEffect, useCallback } from 'react'
import type { ChannelMember, ChannelState } from '../../lib/chat/domain/types'
import { Shield, ShieldCheck, Volume2, VolumeX } from 'lucide-react'
import Avatar from './Avatar'
import { getNickColor } from '../../lib/irc/colors'

interface ManageMembersModalProps {
  channel: ChannelState
  currentUserId: number
  myRole: string | null
  onClose: () => void
  onApiCall: <T>(method: string, path: string, body?: any) => Promise<T>
  onMemberChanged?: () => void
}

export default function ManageMembersModal({
  channel, currentUserId, myRole, onClose, onApiCall, onMemberChanged,
}: ManageMembersModalProps) {
  const [members, setMembers] = useState<ChannelMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const isAdmin = myRole === 'admin'
  const canModerate = isAdmin || myRole === 'mod'

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true)
      const data = await onApiCall<ChannelMember[]>('GET', `/api/chat/channels/${channel.id}/members`)
      setMembers(data)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [channel.id, onApiCall])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const changeRole = async (targetUserId: number, role: string | null) => {
    setActionLoading(targetUserId)
    try {
      await onApiCall('PATCH', `/api/chat/channels/${channel.id}/members/${targetUserId}/role`, { role })
      await fetchMembers()
      onMemberChanged?.()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setActionLoading(null)
    }
  }

  const toggleMute = async (targetUserId: number, currentlyMuted: boolean) => {
    setActionLoading(targetUserId)
    try {
      await onApiCall('PATCH', `/api/chat/channels/${channel.id}/members/${targetUserId}/mute`, { muted: !currentlyMuted })
      await fetchMembers()
      onMemberChanged?.()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setActionLoading(null)
    }
  }

  const canMute = (m: ChannelMember) => {
    if (m.id === currentUserId) return false
    if (m.role === 'admin') return false
    if (m.role === 'mod') return false
    return canModerate
  }

  const canChangeRole = (m: ChannelMember) => {
    if (m.id === currentUserId) return false
    if (!isAdmin) return false
    return true
  }

  const canPromoteToAdmin = (m: ChannelMember) => {
    return canChangeRole(m) && m.role !== 'admin'
  }

  const canPromoteToMod = (m: ChannelMember) => {
    return canChangeRole(m) && m.role !== 'mod' && m.role !== 'admin'
  }

  const canRemoveRole = (m: ChannelMember) => {
    return canChangeRole(m) && m.role !== null
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 rounded-2xl p-5 w-full max-w-md mx-4 shadow-floating border border-slate-800 animate-scale-in flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-100">
            Miembros de {channel.name.replace(/^#/, '')}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1"
            aria-label="Cerrar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-rose-900/40 border border-rose-500/30 text-rose-200 text-xs">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-slate-500 text-sm text-center py-8">No hay miembros</div>
          ) : (
            <div className="space-y-0.5">
              {members.map(m => {
                const isSelf = m.id === currentUserId
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar nick={m.display_name} size="sm" />
                      {m.active && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-sm truncate font-medium"
                          style={{ color: getNickColor(m.display_name) }}
                        >
                          {m.display_name}
                        </span>
                        {isSelf && (
                          <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded font-medium">
                            tú
                          </span>
                        )}
                        {m.role === 'admin' && (
                          <span title="Admin"><Shield className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" /></span>
                        )}
                        {m.role === 'mod' && (
                          <span title="Moderador"><ShieldCheck className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" /></span>
                        )}
                        {m.muted && (
                          <span title="Silenciado"><VolumeX className="w-3 h-3 text-rose-400 flex-shrink-0" /></span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{m.email}</div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {actionLoading === m.id ? (
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          {canMute(m) && (
                            <button
                              onClick={() => toggleMute(m.id, m.muted)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                m.muted
                                  ? 'text-rose-400 hover:bg-rose-900/30'
                                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
                              }`}
                              title={m.muted ? 'Quitar silencio' : 'Silenciar'}
                            >
                              {m.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            </button>
                          )}
                          {canPromoteToAdmin(m) && (
                            <button
                              onClick={() => changeRole(m.id, 'admin')}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-slate-700/50 transition-colors"
                              title="Promover a admin"
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                          )}
                          {canPromoteToMod(m) && (
                            <button
                              onClick={() => changeRole(m.id, 'mod')}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-slate-700/50 transition-colors"
                              title="Promover a moderador"
                            >
                              <ShieldCheck className="w-4 h-4" />
                            </button>
                          )}
                          {canRemoveRole(m) && (
                            <button
                              onClick={() => changeRole(m.id, null)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-700/50 transition-colors"
                              title="Quitar rol"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 pt-3 border-t border-slate-800 mt-3">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}