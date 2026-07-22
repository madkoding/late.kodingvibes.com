import { useEffect, useState } from 'react'
import { FileText, Music, Download, Clock, Maximize2 } from 'lucide-react'
import { ImageContextMenuPortal } from './ImagePreview'
import AudioWaveform from './AudioWaveform'

interface AttachmentMeta {
  id: string
  kind: string
  filename: string
  mime: string
  size_bytes: number
  expires_at: number
  url?: string
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatExpiry(ts: number): string {
  const remaining = ts * 1000 - Date.now()
  if (remaining <= 0) return 'expirado'
  const days = Math.floor(remaining / 86400000)
  const hours = Math.floor((remaining % 86400000) / 3600000)
  if (days > 0) return `expira en ${days}d ${hours}h`
  const mins = Math.floor(remaining / 60000)
  if (mins > 0) return `expira en ${mins}min`
  return 'expira pronto'
}

function countdownLabel(ts: number): string {
  const remaining = ts * 1000 - Date.now()
  if (remaining <= 0) return ''
  const days = Math.floor(remaining / 86400000)
  const hours = Math.floor((remaining % 86400000) / 3600000)
  const mins = Math.floor((remaining % 3600000) / 60000)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export default function AttachmentCard({
  attachmentId,
  onFloat,
  onVideoPlay,
  onVideoRef,
  floatingVideo,
}: {
  attachmentId: string
  onFloat?: (attachmentId: string) => void
  onVideoPlay?: (attachmentId: string) => void
  onVideoRef?: (attachmentId: string, el: HTMLVideoElement | null) => void
  floatingVideo?: string | null
}) {
  const [meta, setMeta] = useState<AttachmentMeta | null>(null)
  const [error, setError] = useState(false)
  const [expiresLabel, setExpiresLabel] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch(`/api/chat/attachments/${attachmentId}/meta`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled && data) {
          setMeta(data)
          setExpiresLabel(formatExpiry(data.expires_at))
        } else if (!cancelled) {
          setError(true)
        }
      })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [attachmentId])

  useEffect(() => {
    if (!meta) return
    const tick = () => setExpiresLabel(countdownLabel(meta.expires_at))
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [meta])

  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-900/20 border border-rose-800/40 text-xs text-rose-300">
        <FileText className="w-4 h-4" />
        Archivo no disponible
      </div>
    )
  }

  if (!meta) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs text-slate-500">
        <span className="w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
        Cargando archivo…
      </div>
    )
  }

  const ext = meta.filename.split('.').pop()?.toUpperCase() || ''

  if (meta.kind === 'image') {
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
    const imgUrl = `/api/chat/attachments/${attachmentId}`
    return (
      <>
        <div className="relative group">
          <img
            src={imgUrl}
            alt={meta.filename}
            className="block max-w-full max-h-72 object-contain rounded-lg border border-slate-700/60 bg-slate-950"
            loading="lazy"
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setCtxMenu({ x: e.clientX, y: e.clientY })
            }}
          />
          <div className="absolute bottom-1 right-1 flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/70 text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
            <Clock className="w-3 h-3" />
            {expiresLabel}
          </div>
        </div>
        {ctxMenu && (
          <ImageContextMenuPortal
            url={imgUrl}
            x={ctxMenu.x}
            y={ctxMenu.y}
            onClose={() => setCtxMenu(null)}
          />
        )}
      </>
    )
  }

  if (meta.kind === 'audio') {
    return (
      <div className="flex flex-col gap-1 min-w-[260px]">
        <AudioWaveform
          src={`/api/chat/attachments/${attachmentId}`}
          filename={meta.filename}
        />
        <div className="flex items-center gap-1 text-[10px] text-slate-500 px-1 truncate">
          <Music className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{meta.filename}</span>
        </div>
      </div>
    )
  }

  if (meta.kind === 'video') {
    const isFloating = floatingVideo === attachmentId
    return (
      <div className="group relative">
        {isFloating ? (
          <div className="rounded-lg border border-dashed border-slate-700/40 bg-slate-900/40 px-3 py-2 text-[11px] text-slate-500 text-center">
            Video flotando
          </div>
        ) : (
          <video
            ref={el => { if (el !== null) onVideoRef?.(attachmentId, el) }}
            src={`/api/chat/attachments/${attachmentId}`}
            controls
            className="max-w-full max-h-72 rounded-lg border border-slate-700/60 bg-slate-950"
            preload="metadata"
            onPlay={() => onVideoPlay?.(attachmentId)}
          >
            Tu navegador no soporta video.
          </video>
        )}
        <button
          type="button"
          onClick={() => onFloat?.(attachmentId)}
          className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-slate-300 hover:text-white flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Flotar video"
          title="Flotar video"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center gap-1.5 px-1 pt-1 text-[10px] text-slate-500">
          <Clock className="w-3 h-3" />
          Video expira en: {expiresLabel}
        </div>
      </div>
    )
  }

  // Document / File
  return (
    <a
      href={`/api/chat/attachments/${attachmentId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-colors group min-w-[220px]"
    >
      <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 flex-shrink-0">
        {ext || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-200 truncate group-hover:text-indigo-300 transition-colors">{meta.filename}</div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
          <span>{formatFileSize(meta.size_bytes)}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{expiresLabel}</span>
        </div>
      </div>
      <Download className="w-4 h-4 text-slate-400 flex-shrink-0" />
    </a>
  )
}
