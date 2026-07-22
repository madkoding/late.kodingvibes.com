import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Reaction } from '../../lib/irc/types'
import { getEmoji } from '../../lib/emoji'

function EmojiIcon({ name, size = 16 }: { name: string; size?: number }) {
  const def = getEmoji(name)
  if (!def) return null
  const html = def.svg.replace(/^<svg /, `<svg width="${size}" height="${size}" `)
  return (
    <span
      className="inline-flex items-center justify-center align-middle shrink-0"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

interface ReactionCount {
  emoji: string
  count: number
  mine: boolean
}

interface MessageReactionsProps {
  reactions: Reaction[]
  myUserId: number | null
  nickByUserId: Map<number, string>
  onToggle: (emoji: string) => void
}

function ReactionDetailPopup({
  emoji,
  reactors,
  nickByUserId,
  anchorRect,
  onClose,
}: {
  emoji: string
  reactors: Reaction[]
  nickByUserId: Map<number, string>
  anchorRect: DOMRect
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
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
  }, [onClose])

  const popupH = Math.min(reactors.length * 30 + 40, 200)
  const spaceBelow = window.innerHeight - anchorRect.bottom
  const top = spaceBelow >= popupH + 8
    ? anchorRect.bottom + 4
    : Math.max(4, anchorRect.top - popupH - 4)
  const left = Math.min(anchorRect.left, window.innerWidth - 180)

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[270] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 px-3 min-w-[160px] max-w-[220px] overflow-y-auto select-none"
      style={{ left, top, maxHeight: 200 }}
    >
      <div className="flex items-center gap-2 pb-1.5 mb-1.5 border-b border-slate-700/50">
        <EmojiIcon name={emoji} size={16} />
        <span className="text-xs font-semibold text-slate-300">Reacciones</span>
        <span className="text-[10px] text-slate-500 ml-auto">{reactors.length}</span>
      </div>
      {reactors.map(r => (
        <div key={`${r.user_id}-${r.emoji}`} className="flex items-center gap-2 py-1 text-sm text-slate-200">
          <EmojiIcon name={emoji} size={14} />
          <span className="truncate">{nickByUserId.get(r.user_id) ?? `user-${r.user_id}`}</span>
        </div>
      ))}
    </div>,
    document.body,
  )
}

/**
 * Renders the reaction chips under a message bubble plus a
 * hover-triggered picker to add new ones. The picker opens
 * on hover (desktop) or click (mobile) of the "+" button.
 * Long-press on a reaction chip shows a popup with the list
 * of who reacted.
 */
export default function MessageReactions({
  reactions,
  myUserId,
  nickByUserId,
  onToggle,
}: MessageReactionsProps) {
  const [popup, setPopup] = useState<{ emoji: string; rect: DOMRect } | null>(null)
  const longPressRef = useRef(false)

  const groups = new Map<string, { count: number; mine: boolean }>()
  for (const r of reactions) {
    const g = groups.get(r.emoji) ?? { count: 0, mine: false }
    g.count += 1
    if (myUserId !== null && r.user_id === myUserId) g.mine = true
    groups.set(r.emoji, g)
  }
  const sorted = Array.from(groups.entries()).sort((a, b) => b[1].count - a[1].count)

  return (
    <div className="mt-1 flex flex-wrap gap-1 items-center">
      {sorted.map(([emoji, { count, mine }]) => {
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              if (longPressRef.current) {
                longPressRef.current = false
                return
              }
              onToggle(emoji)
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              longPressRef.current = true
              setTimeout(() => { longPressRef.current = false }, 400)
              setPopup({ emoji, rect: e.currentTarget.getBoundingClientRect() })
            }}
            className={`inline-flex items-center gap-1.5 rounded-full text-sm pl-1.5 pr-2 py-1 border transition-colors ${
              mine
                ? 'bg-indigo-500/30 border-indigo-400/60 text-indigo-100 hover:bg-indigo-500/40'
                : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <EmojiIcon name={emoji} size={18} />
            <span className="tabular-nums">{count}</span>
          </button>
        )
      })}
      {popup && (
        <ReactionDetailPopup
          emoji={popup.emoji}
          reactors={reactions.filter(r => r.emoji === popup.emoji)}
          nickByUserId={nickByUserId}
          anchorRect={popup.rect}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  )
}

interface CompactReactionButtonProps {
  reactions: ReactionCount[]
  onToggle: (emoji: string) => void
}

/**
 * One floating "+" button anchored to the top-right (own
 * bubbles) or top-left (other bubbles) of the message bubble.
 * Tapping it opens a quick-emoji picker; existing reactions
 * appear as small inline chips so the user can see them at
 * a glance and tap to toggle. Designed for grouped messages
 * where you don't want a picker row per message.
 */
export function CompactReactionButton({
  reactions,
  onToggle,
}: CompactReactionButtonProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const quickEmojis = ['heart', 'thumbsup', 'thumbsdown', 'laugh', 'smile', 'point', 'cry', 'serious', 'angry', 'fire', 'star', 'sparkles', 'rocket', 'check']

  const [align, setAlign] = useState<'left' | 'right'>('left')
  useEffect(() => {
    if (!open || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const pickerW = 240
    const margin = 8
    const overflowsRight = rect.left + pickerW > window.innerWidth - margin
    const overflowsLeft = rect.right - pickerW < margin
    if (overflowsRight) setAlign('right')
    else if (overflowsLeft) setAlign('left')
    else setAlign('left')
  }, [open])

  return (
    <div
      ref={ref}
      className="relative"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-0.5 bg-slate-900/80 backdrop-blur border border-slate-700/60 rounded-full pl-0.5 pr-1 py-0.5 shadow-lg">
        {reactions.slice(0, 3).map(r => {
          return (
            <button
              key={r.emoji}
              type="button"
              onClick={() => onToggle(r.emoji)}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] transition-colors ${
                r.mine
                  ? 'bg-indigo-500/30 text-indigo-100 hover:bg-indigo-500/40'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <EmojiIcon name={r.emoji} size={12} />
              <span className="tabular-nums">{r.count}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="w-5 h-5 rounded-full text-slate-400 hover:text-slate-100 hover:bg-slate-800 flex items-center justify-center text-sm leading-none transition-colors"
          title="Añadir reacción"
          aria-label="Añadir reacción"
        >
          +
        </button>
      </div>
      {open && (
        <div
          className={`absolute top-full mt-1 z-30 grid grid-cols-7 gap-1 bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-xl w-[230px] ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {quickEmojis.map(name => {
            return (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onToggle(name)
                  setOpen(false)
                }}
                className="aspect-square rounded-md text-slate-100 hover:bg-slate-800 hover:text-white flex items-center justify-center transition-colors"
                title={name}
                aria-label={name}
              >
<EmojiIcon name={name} size={16} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
