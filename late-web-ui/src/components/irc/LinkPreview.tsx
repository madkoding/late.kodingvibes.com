import type { OgData } from '../../lib/chat/domain/types'

interface LinkPreviewProps {
  og: OgData
  onOpen: (url: string) => void
}

/**
 * Compact, link-out preview card for a message. Shows the
 * OG image (if any), the site name + title + description.
 * Clicking anywhere on the card opens the original URL.
 */
export default function LinkPreview({ og, onOpen }: LinkPreviewProps) {
  const hasImage = !!og.image
  const title = og.title || og.url
  const siteName = og.site_name || hostnameOf(og.url)

  return (
    <button
      type="button"
      onClick={() => onOpen(og.url)}
      className="block text-left rounded-lg border border-slate-700/60 bg-slate-900/60 hover:border-indigo-500 hover:bg-slate-900 transition-colors overflow-hidden max-w-sm"
      aria-label={`Abrir ${title}`}
    >
      <div className="flex">
        {hasImage && (
          <div className="w-24 sm:w-32 flex-shrink-0 bg-slate-950">
            <img
              src={og.image}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                // Hide the image column if the URL 404s.
                (e.currentTarget.parentElement as HTMLElement | null)?.remove()
              }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0 p-2.5">
          {siteName && (
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 truncate">
              {siteName}
            </div>
          )}
          <div className="text-sm font-semibold text-slate-100 line-clamp-2 leading-snug mt-0.5">
            {title}
          </div>
          {og.description && (
            <div className="text-xs text-slate-400 line-clamp-2 mt-0.5">
              {og.description}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}
