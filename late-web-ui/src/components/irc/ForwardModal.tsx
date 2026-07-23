import { useState, useMemo } from 'react'
import { X, Hash, CornerUpRight } from 'lucide-react'
import type { ChannelState, ChatMessage } from '../../lib/chat/domain/types'
import { hasImageMarker } from '../../lib/chat/domain/parsers'

interface ForwardModalProps {
  message: ChatMessage
  channels: Map<number, ChannelState>
  currentChannelId: number | null
  onClose: () => void
  onForward: (messageId: number, targetChannelId: number) => Promise<void>
}

export default function ForwardModal({
  message, channels, currentChannelId, onClose, onForward,
}: ForwardModalProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')

  const joinedChannels = useMemo(() => {
    return Array.from(channels.values())
      .filter(c => c.joined)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [channels])

  const filtered = useMemo(() => {
    if (!search.trim()) return joinedChannels
    const q = search.toLowerCase()
    return joinedChannels.filter(c => c.name.toLowerCase().includes(q))
  }, [joinedChannels, search])

  const handleConfirm = async () => {
    if (selectedId === null) return
    setSending(true)
    try {
      await onForward(message.id, selectedId)
      onClose()
    } catch {
      setSending(false)
    }
  }

  const preview = useMemo(() => {
    if (!message) return ''
    if (hasImageMarker(message.content)) return '[imagen]'
    return message.content.length > 100
      ? message.content.slice(0, 97) + '…'
      : message.content
  }, [message])

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <CornerUpRight className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-slate-100">Reenviar mensaje</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 flex items-center justify-center transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview */}
        <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800">
          <div className="flex items-start gap-2.5">
            <span className="text-xs font-semibold text-cyan-400/80 shrink-0 mt-0.5">{message.display_name}</span>
            <span className="text-sm text-slate-400 line-clamp-2 break-words">{preview}</span>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 py-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar canal..."
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
          />
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 min-h-0 space-y-1">
          {filtered.length === 0 && (
            <div className="text-center py-8 text-sm text-slate-500">
              {search ? 'No se encontraron canales' : 'No sos miembro de ningún canal'}
            </div>
          )}
          {filtered.map(ch => {
            const isCurrent = ch.id === currentChannelId
            const isSelected = ch.id === selectedId
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setSelectedId(ch.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                  isSelected
                    ? 'bg-cyan-500/15 border border-cyan-500/30'
                    : 'border border-transparent hover:bg-slate-800'
                }`}
              >
                <Hash className={`w-4 h-4 shrink-0 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium truncate ${isSelected ? 'text-cyan-200' : 'text-slate-200'}`}>
                      {ch.name}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 font-medium shrink-0">
                        actual
                      </span>
                    )}
                  </div>
                  {ch.description && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">{ch.description}</p>
                  )}
                </div>
              </button>
            )
          })}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={selectedId === null || sending}
            onClick={handleConfirm}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors bg-cyan-500 hover:bg-cyan-400 text-white disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Reenviando…
              </>
            ) : (
              <>
                <CornerUpRight className="w-4 h-4" />
                Reenviar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
