import { useEffect, useRef, useState } from 'react'
import { listEmojis } from '../../lib/emoji'

interface EmojiPickerProps {
  onSelect: (name: string) => void
  onClose: () => void
}

/**
 * Popover grid of custom SVG emojis. Each tile is a button
 * that, when clicked, inserts the shortcode `:name:` into
 * the input via the parent's onSelect callback.
 */
export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [filter, setFilter] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const all = listEmojis()
  const filtered = filter
    ? all.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()))
    : all

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 left-0 z-40 w-72 max-w-[calc(100vw-1.5rem)] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 select-none"
      role="dialog"
      aria-label="Emojis"
    >
      <input
        type="text"
        autoFocus
        placeholder="Buscar emoji…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        className="w-full px-2.5 py-1.5 mb-2 rounded-md bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
      />
      <div className="grid grid-cols-6 gap-1 max-h-60 overflow-y-auto">
        {filtered.map(e => (
          <button
            key={e.name}
            type="button"
            onClick={() => onSelect(e.name)}
            className="aspect-square flex items-center justify-center rounded-md text-slate-100 hover:bg-slate-800 hover:text-white transition-colors"
            title={`:${e.name}:`}
            aria-label={e.name}
          >
            <span
              className="w-5 h-5"
              // The SVG is fully self-contained and uses
              // currentColor; we control the rendered color
              // through the parent text-* class.
              dangerouslySetInnerHTML={{ __html: e.svg }}
            />
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-6 text-center text-xs text-slate-500 py-6">
            sin resultados
          </div>
        )}
      </div>
    </div>
  )
}
