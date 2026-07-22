interface TypingIndicatorProps {
  /** Display names of the users who are currently typing.
   *  Order matches insertion order. Empty array hides the
   *  indicator. */
  names: string[]
}

/**
 * Shows "<names> escribiendo…" with three bouncing dots.
 * Singular / plural is handled ("X está escribiendo…" vs
 * "X e Y están escribiendo…").
 *
 * Always reserves its vertical space (min-height) even when
 * no one is typing, so the chat layout above doesn't jump
 * up and down as users start/stop typing.
 */
export default function TypingIndicator({ names }: TypingIndicatorProps) {
  if (names.length === 0) {
    return (
      <div
        className="px-4 py-1.5 text-xs text-slate-500 flex items-center gap-1.5 min-h-[28px] invisible"
        aria-hidden="true"
      />
    )
  }

  let label: string
  if (names.length === 1) {
    label = `${names[0]} está escribiendo`
  } else if (names.length === 2) {
    label = `${names[0]} y ${names[1]} están escribiendo`
  } else {
    label = 'Varios están escribiendo'
  }

  return (
    <div
      className="px-4 py-1.5 text-xs text-slate-500 flex items-center gap-1.5 min-h-[28px]"
      role="status"
      aria-live="polite"
    >
      <span className="truncate">{label}</span>
      <span className="inline-flex gap-0.5" aria-hidden="true">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" />
      </span>
    </div>
  )
}
