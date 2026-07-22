import { useEffect, useRef, useState, useCallback } from 'react'
import { Play, Pause, Volume2, VolumeX, X, PictureInPicture2, SkipBack, SkipForward } from 'lucide-react'
import { useAudio } from './AudioProvider'
import { STREAMS } from '@/lib/streams'
import { MarqueeLink } from './miniplayer/MarqueeLink'
import { SpectrumCanvas } from './miniplayer/SpectrumCanvas'
import { loadPos, savePos, loadCollapsed, saveCollapsed, loadFloating, saveFloating, EXPANDED_W, COLLAPSED_W, DEFAULT_H, defaultPos, clampPos } from './miniplayer/persistence'

export default function MiniPlayer() {
  const audio = useAudio()

  // Drag position (desktop only) — top-left corner of the card in viewport space.
  // Always starts with a default position so the player is visible
  // before the first user interaction.
  const [pos, setPos] = useState<{ x: number; y: number }>(() => loadPos() ?? defaultPos())
  const [collapsed, setCollapsed] = useState<boolean>(() => loadCollapsed())
  const [floating, setFloating] = useState<boolean>(() => loadFloating())
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null)
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.innerWidth >= 640,
  )

  const analyserRef = useRef<AnalyserNode | null>(null)

  // Persist
  useEffect(() => { savePos(pos) }, [pos])
  useEffect(() => { saveCollapsed(collapsed) }, [collapsed])
  useEffect(() => { saveFloating(floating) }, [floating])

  // Track viewport width so we can switch between mobile (pinned to
  // bottom) and desktop (floating card) layouts.
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 640)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Pull the analyser from the shared AudioProvider. Re-run whenever
  // the current stream changes so a fresh source -> analyser chain is
  // set up for the new audio src.
  useEffect(() => {
    let cancelled = false
    const tryAttach = () => {
      if (cancelled) return true
      const el = audio.getAudioElement()
      const analyser = audio.getAnalyser()
      if (!el || !analyser) return false
      analyserRef.current = analyser
      return true
    }
    if (!tryAttach()) {
      const t = setInterval(() => {
        if (tryAttach()) clearInterval(t)
      }, 200)
      return () => {
        cancelled = true
        clearInterval(t)
      }
    }
  }, [audio, audio.current?.mount])

  // Clamp the persisted position on resize so the card never escapes
  // the viewport if the window shrinks after the user dragged it.
  // Only relevant when the card is in floating mode.
  const isFloating = isDesktop && floating
  useEffect(() => {
    if (!isFloating) return
    setPos(p => clampPos(p, collapsed ? COLLAPSED_W : EXPANDED_W, DEFAULT_H))
  }, [isFloating, collapsed])

  const onGripPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const card = (e.currentTarget as HTMLElement).parentElement as HTMLElement
    const r = card.getBoundingClientRect()
    const cur = { x: r.left, y: r.top }
    setPos(cur) // make sure the in-memory position matches what the user is grabbing
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: cur.x,
      origY: cur.y,
      moved: false,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const onGripPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.hypot(dx, dy) < 6) return
    d.moved = true
    const card = (e.currentTarget as HTMLElement).parentElement as HTMLElement | null
    const cardW = card?.offsetWidth ?? (collapsed ? COLLAPSED_W : EXPANDED_W)
    const cardH = card?.offsetHeight ?? DEFAULT_H
    setPos(clampPos({ x: d.origX + dx, y: d.origY + dy }, cardW, cardH))
  }, [])

  const onGripPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* ignore */ }
    // Single click is reserved for drag-start; the toggle uses double
    // click so accidental taps don't collapse the player.
  }, [])

  // Double-click on the grip toggles the collapsed state.
  const onGripDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setCollapsed(c => !c)
  }, [])

  // prev/next cycle through the SomaFM stream list. Declared here
  // (before the early-return below) so the hook order stays the
  // same whether or not a stream is currently playing. If we
  // declared them after `if (!audio.current) return null`, the
  // first render of MiniPlayer (no stream) would skip them and
  // the second render (stream loaded) would add them — that's
  // a hooks-order violation and React throws #310.
  const goNext = useCallback(() => {
    const list = STREAMS
    if (list.length === 0) return
    const idx = Math.max(0, list.findIndex(s => s.mount === audio.current?.mount))
    const next = list[(idx + 1) % list.length]
    audio.play(next)
  }, [audio])
  const goPrev = useCallback(() => {
    const list = STREAMS
    if (list.length === 0) return
    const idx = list.findIndex(s => s.mount === audio.current?.mount)
    const prev = list[(idx <= 0 ? list.length : idx) - 1]
    audio.play(prev)
  }, [audio])

  if (!audio.current) return null

  // Desktop: by default the player is pinned to the bottom edge
  // (like mobile). The user can press the detach button to lift
  // it into a draggable floating card. Mobile is always pinned.
  const isPinned = !isDesktop || !floating

  const positionStyle: React.CSSProperties = !isPinned
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : {}

  return (
    <div
      className={
        isPinned
          ? 'fixed bottom-0 left-0 right-0 z-50 animate-slide-in-from-bottom'
          : 'fixed z-50 transition-[width] duration-200 ease-out animate-scale-in'
      }
      style={{
        ...positionStyle,
        width: !isPinned ? (collapsed ? 132 : EXPANDED_W) : undefined,
      }}
    >
      <div
        className={
          isPinned
            ? 'bg-slate-900/95 backdrop-blur border-t border-slate-700 shadow-2xl overflow-hidden flex'
            : 'bg-slate-900/95 backdrop-blur border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex'
        }
      >
        {/* Drag handle (only when floating). Double-click toggles collapse. */}
        {!isPinned && (
          <div
            onPointerDown={onGripPointerDown}
            onPointerMove={onGripPointerMove}
            onPointerUp={onGripPointerUp}
            onPointerCancel={onGripPointerUp}
            onDoubleClick={onGripDoubleClick}
            className="hidden sm:flex flex-col items-center justify-center gap-1 w-6 cursor-grab active:cursor-grabbing border-r border-slate-800/60 hover:bg-slate-800/40 transition-colors touch-none flex-shrink-0 select-none"
            aria-label="Arrastrar para mover · Doble clic para colapsar"
            title="Arrastra · Doble clic para colapsar"
            role="button"
          >
            <span className="flex flex-col items-center gap-[3px]">
              <span className="w-1 h-1 rounded-full bg-slate-500" />
              <span className="w-1 h-1 rounded-full bg-slate-500" />
              <span className="w-1 h-1 rounded-full bg-slate-500" />
            </span>
          </div>
        )}

        {/* Body */}
        <div
          className={
            isPinned
              ? 'flex items-center gap-1.5 px-2 py-2 min-w-0 flex-1'
              : `flex items-center gap-2 ${collapsed ? 'pr-4' : ''} px-3 py-2 min-w-0 flex-1`
          }
        >
          {/* Pinned (mobile OR desktop-without-floating): chip + spectrum + prev/play/next, with optional detach. */}
          {isPinned && (
            <>
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className={`text-base leading-none flex-shrink-0 ${audio.current.accent || 'text-indigo-400'}`}>
                  {audio.current.emoji || '♪'}
                </span>
                <div className="min-w-0 flex flex-col leading-tight flex-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 truncate">
                    {audio.current.category || audio.current.name}
                  </span>
                  <MarqueeLink
                    to="/icecast"
                    text={audio.track
                      ? [audio.track.artist, audio.track.title].filter(Boolean).join(' — ') || audio.current.name
                      : (audio.current.artist || audio.current.title || audio.current.name)}
                    className="text-sm font-medium text-slate-100"
                  />
                </div>
              </div>

              <SpectrumCanvas
                analyser={analyserRef.current}
                className="hidden sm:block flex-shrink-0 h-6 w-32 md:w-40"
                style={{ minWidth: 0 }}
              />

              <button
                onClick={audio.toggleMute}
                className="w-8 h-8 rounded-lg text-slate-300 hover:text-slate-100 hover:bg-slate-800 flex items-center justify-center flex-shrink-0 transition-colors"
                aria-label={audio.muted ? 'Activar sonido' : 'Silenciar'}
                title={audio.muted ? 'Activar sonido' : 'Silenciar'}
              >
                {audio.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={audio.muted ? 0 : audio.volume}
                onChange={(e) => audio.setVolume(Number(e.target.value))}
                className="w-16 sm:w-14 md:w-20 accent-indigo-500 flex-shrink-0"
                aria-label="Volumen"
              />

              <button
                onClick={goPrev}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center flex-shrink-0 transition-all hover:scale-105 active:scale-95 select-none"
                aria-label="Canal anterior"
                title="Canal anterior"
              >
                <SkipBack className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <button
                onClick={audio.toggle}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white flex items-center justify-center flex-shrink-0 transition-all hover:scale-105 active:scale-95 shadow-md hover:shadow-lg select-none"
                aria-label={audio.playing ? 'Pausar' : 'Reproducir'}
              >
                {audio.loading ? (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : audio.playing ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 translate-x-[1px]" />
                )}
              </button>

              <button
                onClick={goNext}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center flex-shrink-0 transition-all hover:scale-105 active:scale-95 select-none"
                aria-label="Canal siguiente"
                title="Canal siguiente"
              >
                <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              {isDesktop && (
                <button
                  onClick={() => setFloating(true)}
                  className="w-7 h-7 rounded-lg text-slate-500 hover:text-slate-100 hover:bg-slate-800 flex items-center justify-center flex-shrink-0 transition-colors"
                  aria-label="Desacoplar y mover"
                  title="Desacoplar · arrastrable"
                >
                  <PictureInPicture2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}

          {/* Floating (desktop-only, when detach is on): spectrum + play + extras, draggable. */}
          {!isPinned && (
            <>
              {!collapsed && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`text-base leading-none ${audio.current.accent || 'text-indigo-400'}`}>
                    {audio.current.emoji || '♪'}
                  </span>
                  <span className="text-xs font-semibold text-slate-300 truncate max-w-[6rem]">
                    {audio.current.category || audio.current.name}
                  </span>
                </div>
              )}

              {!collapsed && (
                <MarqueeLink
                  to="/icecast"
                  text={audio.track
                    ? [audio.track.artist, audio.track.title].filter(Boolean).join(' — ') || audio.current.name
                    : (audio.current.artist || audio.current.title || audio.current.name)}
                  className="text-sm font-medium text-slate-100 max-w-[9rem]"
                />
              )}

              <SpectrumCanvas
                analyser={analyserRef.current}
                className="hidden sm:block flex-1 h-6 sm:h-7 min-w-0"
                style={{ minWidth: collapsed ? 48 : 0 }}
              />

              <button
                onClick={audio.toggle}
                className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white flex items-center justify-center flex-shrink-0 transition-all hover:scale-105 active:scale-95 shadow-md select-none"
                aria-label={audio.playing ? 'Pausar' : 'Reproducir'}
              >
                {audio.loading ? (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : audio.playing ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 translate-x-[1px]" />
                )}
              </button>

              {!collapsed && (
                <>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`w-2 h-2 rounded-full ${audio.playing ? 'bg-emerald-400' : 'bg-slate-500'} ${audio.playing ? 'animate-pulse' : ''}`} />
                  </div>

                  <button
                    onClick={audio.toggleMute}
                    className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 flex items-center justify-center flex-shrink-0 transition-colors hidden sm:flex"
                    aria-label={audio.muted ? 'Activar sonido' : 'Silenciar'}
                  >
                    {audio.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={audio.muted ? 0 : audio.volume}
                    onChange={(e) => audio.setVolume(Number(e.target.value))}
                    className="w-12 sm:w-16 hidden sm:block accent-indigo-500"
                    aria-label="Volumen"
                  />

                  <button
                    onClick={() => setFloating(false)}
                    className="w-7 h-7 rounded-lg text-slate-500 hover:text-slate-100 hover:bg-slate-800 flex items-center justify-center flex-shrink-0 transition-colors"
                    aria-label="Volver a fijar abajo"
                    title="Fijar abajo"
                  >
                    <PictureInPicture2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={audio.stop}
                    className="w-7 h-7 rounded-lg text-slate-500 hover:text-slate-100 hover:bg-slate-800 flex items-center justify-center flex-shrink-0 transition-colors"
                    aria-label="Detener"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
