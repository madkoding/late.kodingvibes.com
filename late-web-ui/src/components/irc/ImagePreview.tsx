import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X, Download, Copy } from 'lucide-react'

export function ImageContextMenuPortal({
  url, x, y, onClose,
}: {
  url: string; x: number; y: number; onClose: () => void
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

  const handleCopy = async () => {
    try {
      const resp = await fetch(url)
      const blob = await resp.blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    } catch {}
    onClose()
  }

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = url
    a.download = 'imagen.webp'
    a.click()
    onClose()
  }

  const menuW = 180
  const vpW = window.innerWidth
  const vpH = window.innerHeight
  const left = Math.min(x, vpW - menuW - 8)
  const top = Math.min(y, vpH - 80 - 8)

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[310] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 min-w-[180px] overflow-hidden select-none"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={handleCopy}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
      >
        <Copy className="w-4 h-4 text-indigo-400" />
        Copiar imagen
      </button>
      <button
        type="button"
        onClick={handleDownload}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
      >
        <Download className="w-4 h-4 text-indigo-400" />
        Descargar imagen
      </button>
    </div>,
    document.body,
  )
}

interface ImagePreviewProps {
  dataUrl: string
  onOpen: (src: string) => void
}

export default function ImagePreview({ dataUrl, onOpen }: ImagePreviewProps) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  return (
    <>
      <button
        onClick={() => onOpen(dataUrl)}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setCtxMenu({ x: e.clientX, y: e.clientY })
        }}
        onTouchStart={(e) => e.stopPropagation()}
        className="block rounded-lg overflow-hidden border border-slate-700/60 hover:border-indigo-500 transition-colors"
        aria-label="Abrir imagen"
      >
        <img
          src={dataUrl}
          alt="imagen pegada"
          className="block max-w-full max-h-72 object-contain bg-slate-950"
          loading="lazy"
          draggable={false}
        />
      </button>
      {ctxMenu && (
        <ImageContextMenuPortal
          url={dataUrl}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  )
}

const IMAGE_PREFIX = '__late_image__:'
const IMAGE_PREFIX_FALLBACK = 'late_image__:'
const IMAGES_PREFIX = '__late_images__:'
const IMAGES_PREFIX_FALLBACK = 'late_images__:'

const ALL_IMAGE_MARKERS = [IMAGE_PREFIX, IMAGE_PREFIX_FALLBACK, IMAGES_PREFIX, IMAGES_PREFIX_FALLBACK]

export function hasImageMarker(content: string): boolean {
  return ALL_IMAGE_MARKERS.some(m => content.includes(m))
}

function findImageMarker(content: string): { marker: string; pos: number; prefixLen: number } | null {
  for (const m of ALL_IMAGE_MARKERS) {
    const idx = content.indexOf(m)
    if (idx !== -1) return { marker: m, pos: idx, prefixLen: m.length }
  }
  return null
}

export function extractImageUrl(content: string): string | null {
  let idx = content.indexOf(IMAGE_PREFIX)
  let prefixLen = IMAGE_PREFIX.length
  if (idx === -1) {
    idx = content.indexOf(IMAGE_PREFIX_FALLBACK)
    if (idx === -1) return null
    prefixLen = IMAGE_PREFIX_FALLBACK.length
  }
  return content.slice(idx + prefixLen)
}

export function extractImageCaption(content: string): string | null {
  let idx = content.indexOf(IMAGE_PREFIX)
  if (idx === -1) {
    idx = content.indexOf(IMAGE_PREFIX_FALLBACK)
    if (idx === -1) idx = findImagesPrefixPos(content)
  }
  if (idx === -1) return null
  if (idx <= 0) return null
  return content.slice(0, idx).replace(/\n+$/, '')
}

function findImagesPrefixPos(content: string): number {
  const i1 = content.indexOf(IMAGES_PREFIX)
  if (i1 !== -1) return i1
  return content.indexOf(IMAGES_PREFIX_FALLBACK)
}

export function extractImageUrls(content: string): string[] {
  const found = findImageMarker(content)
  if (!found) return []
  const rest = content.slice(found.pos + found.prefixLen)
  try {
    const parsed = JSON.parse(rest)
    if (Array.isArray(parsed)) return parsed.filter((u): u is string => typeof u === 'string')
    return []
  } catch {
    return []
  }
}

export function extractImagesCaption(content: string): string | null {
  const idx = findImagesPrefixPos(content)
  if (idx === -1) return extractImageCaption(content)
  if (idx <= 0) return null
  return content.slice(0, idx).replace(/\n+$/, '')
}

interface ImageGalleryProps {
  images: string[]
  onOpen: (index: number) => void
}

export function ImageGallery({ images, onOpen }: ImageGalleryProps) {
  const [ctxMenu, setCtxMenu] = useState<{ url: string; x: number; y: number } | null>(null)

  if (images.length === 0) return null
  if (images.length === 1) {
    return (
      <>
        <button
          onClick={() => onOpen(0)}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setCtxMenu({ url: images[0], x: e.clientX, y: e.clientY })
          }}
          onTouchStart={(e) => e.stopPropagation()}
          className="block rounded-lg overflow-hidden border border-slate-700/60 hover:border-indigo-500 transition-colors"
          aria-label="Abrir galería"
        >
          <img
            src={images[0]}
            alt=""
            className="block max-w-full max-h-72 object-contain bg-slate-950"
            loading="lazy"
            draggable={false}
          />
        </button>
        {ctxMenu && (
          <ImageContextMenuPortal
            url={ctxMenu.url}
            x={ctxMenu.x}
            y={ctxMenu.y}
            onClose={() => setCtxMenu(null)}
          />
        )}
      </>
    )
  }

  const MAX_GALLERY = 4
  const visible = images.slice(0, MAX_GALLERY)
  const extra = images.length - MAX_GALLERY

  return (
    <div className="flex flex-col gap-1.5 max-w-full">
      <div className="relative">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
          {visible.map((url, i) => (
            <button
              key={i}
              onClick={() => onOpen(i)}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setCtxMenu({ url, x: e.clientX, y: e.clientY })
              }}
              onTouchStart={(e) => e.stopPropagation()}
              className="flex-shrink-0 rounded-md overflow-hidden border border-slate-700/60 hover:border-indigo-500 transition-colors relative"
              aria-label={`Ir a imagen ${i + 1}`}
            >
              <img
                src={url}
                alt=""
                className="block w-20 h-20 sm:w-24 sm:h-24 object-cover bg-slate-950"
                loading="lazy"
                draggable={false}
              />
              {i === visible.length - 1 && extra > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-sm font-bold">
                  +{extra}
                </div>
              )}
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-950 to-transparent" />
      </div>
      {ctxMenu && (
        <ImageContextMenuPortal
          url={ctxMenu.url}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
}

interface ImageLightboxProps {
  images: string[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}

export function ImageLightbox({ images, index, onIndexChange, onClose }: ImageLightboxProps) {
  const [ctxMenu, setCtxMenu] = useState<{ url: string; x: number; y: number } | null>(null)
  const dragStartXRef = useRef(0)
  const imageRef = useRef<HTMLImageElement>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFiredRef = useRef(false)

  const hasPrev = index > 0
  const hasNext = index < images.length - 1

  const prev = useCallback(() => {
    if (hasPrev) {
      setCtxMenu(null)
      onIndexChange(index - 1)
    }
  }, [hasPrev, index, onIndexChange])

  const next = useCallback(() => {
    if (hasNext) {
      setCtxMenu(null)
      onIndexChange(index + 1)
    }
  }, [hasNext, index, onIndexChange])

  useEffect(() => {
    if (images.length === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (longPressTimerRef.current !== null) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
    }
  }, [images, onClose, prev, next])

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  useEffect(() => {
    setCtxMenu(null)
  }, [index])

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 1) return
    const touch = e.touches[0]
    dragStartXRef.current = touch.clientX
    longPressFiredRef.current = false
    clearLongPress()
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      setCtxMenu({ url: images[index], x: touch.clientX, y: touch.clientY })
    }, 500)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (longPressTimerRef.current !== null) {
      const dx = e.touches[0].clientX - dragStartXRef.current
      if (Math.abs(dx) > 8) clearLongPress()
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    clearLongPress()
    const dx = e.changedTouches[0].clientX - dragStartXRef.current
    if (Math.abs(dx) > 50) {
      if (dx > 0) prev()
      else next()
    }
  }

  if (images.length === 0) return null

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white flex items-center justify-center text-xl z-10"
        aria-label="Cerrar"
      >
        <X className="w-5 h-5" />
      </button>

      {images.length > 1 && (
        <span className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-800/80 text-slate-300 text-xs px-2.5 py-1 rounded-full z-10">
          {index + 1} / {images.length}
        </span>
      )}

      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); prev() }}
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white flex items-center justify-center transition-colors z-10"
          aria-label="Anterior"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); next() }}
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white flex items-center justify-center transition-colors z-10"
          aria-label="Siguiente"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      <div
        className="flex items-center justify-center w-full h-full"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setCtxMenu({ url: images[index], x: e.clientX, y: e.clientY })
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          ref={imageRef}
          key={index}
          src={images[index]}
          alt=""
          className="max-w-full max-h-full object-contain select-none"
          draggable={false}
        />
      </div>
      {ctxMenu && (
        <ImageContextMenuPortal
          url={ctxMenu.url}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
}
