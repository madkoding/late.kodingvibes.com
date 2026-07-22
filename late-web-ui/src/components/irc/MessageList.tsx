import { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { CornerUpRight } from 'lucide-react'
import type { ChatMessage } from '../../lib/irc/types'
import { getNickColor } from '../../lib/irc/colors'
import ImagePreview, { ImageGallery, ImageLightbox, extractImageUrl, extractImageCaption, hasImageMarker, extractImageUrls, extractImagesCaption } from './ImagePreview'
import LinkPreview from './LinkPreview'
import RichText from './RichText'
import MessageContextMenu, { useContextMenuState } from './MessageContextMenu'
import AttachmentCard from './AttachmentCard'
import AudioWaveform from './AudioWaveform'
import MessageReactions from './MessageReactions'
import VoiceNotePlayer from './VoiceNotePlayer'
import './irc.css'

const ATTACHMENT_MARKERS = ['__late_audio__:', '__late_video__:', '__late_document__:', '__late_file__:', '__late_voicenote__:']

function getAttachmentMarker(content: string): { marker: string; id: string; kind: string } | null {
  for (const marker of ATTACHMENT_MARKERS) {
    const idx = content.indexOf(marker)
    if (idx >= 0) {
      const id = content.slice(idx + marker.length).trim()
      const kind = marker.replace('__late_', '').replace('__:', '').replace(':', '')
      return { marker, id, kind }
    }
  }
  return null
}

/**
 * Inline-only markdown renderer for IRC actions and the like:
 * no <p> wrapper, no block elements, just inline emphasis /
 * code / links rendered as a flat string of HTML. The output
 * is sanitized through DOMPurify before reaching the DOM.
 */
function inlineMarkdown(text: string): string {
  const raw = marked.parseInline(text, { gfm: true, breaks: true }) as string
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ['strong', 'em', 'del', 'code', 'a', 'br'],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
  })
}

interface MessageListProps {
  messages: ChatMessage[]
  currentNick: string
  channelName: string
  channelMembers?: { id: number; display_name: string }[]
  /** Map of user_id -> current display_name. */
  nickByUserId?: Map<number, string>
  /** The local user's id. */
  myUserId?: number | null
  /** The current user's role in this channel. */
  myRole?: string | null
  /** Toggle a reaction on a message. */
  onToggleReaction?: (messageId: number, emoji: string) => void
  /** Called when the user scrolls near the top of the list. */
  onLoadMore?: () => Promise<void> | void
  loadingMore?: boolean
  hasMore?: boolean
  /** Reply to a user by quoting their message. */
  onReply?: (message: ChatMessage) => void
  /** Send a buzz (attention signal) to a user. */
  onBuzz?: (targetUserId: number) => void
  /** Copy message text to clipboard. */
  onCopyText?: (text: string) => void
  /** Forward a message to another channel. */
  onForward?: (message: ChatMessage) => void
  /** Hide a message (censor). Admin/mod only. */
  onHide?: (messageId: number) => void
  /** Delete a message. Admin/mod only. */
  onDelete?: (messageId: number) => void
  /** Called when a user clicks the float button on a video. */
  onVideoFloat?: (attachmentId: string) => void
  /** Called when a video starts playing. */
  onVideoPlay?: (attachmentId: string) => void
  /** Called when a video element mounts. Used for floating video. */
  onVideoRef?: (attachmentId: string, el: HTMLVideoElement | null) => void
  /** The currently-floating video attachment ID, if any. */
  floatingVideo?: string | null
}

const HEADER_INTERVAL_S = 300

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDayLabel(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const dDay = new Date(d)
  dDay.setHours(0, 0, 0, 0)
  if (dDay.getTime() === today.getTime()) return 'Hoy'
  if (dDay.getTime() === yesterday.getTime()) return 'Ayer'
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
}


interface DisplayItem {
  type: 'day' | 'system' | 'bubble'
  message: ChatMessage
  isOwn: boolean
}

function buildDisplayList(
  messages: ChatMessage[],
  currentNick: string,
  nickByUserId: Map<number, string>,
): DisplayItem[] {
  const items: DisplayItem[] = []
  let lastDay = -1

  const nickFor = (m: ChatMessage) => nickByUserId.get(m.user_id) ?? m.display_name
  const isOwn = (m: ChatMessage) => nickFor(m) === currentNick

  for (const msg of messages) {
    const day = new Date(msg.created_at * 1000).getDate()
    if (day !== lastDay) {
      items.push({ type: 'day', message: msg, isOwn: false })
      lastDay = day
    }
    items.push({ type: 'bubble', message: msg, isOwn: isOwn(msg) })
  }

  return items
}

function DayDivider({ ts }: { ts: number }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="flex-1 h-px bg-slate-800" />
      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
        {formatDayLabel(ts)}
      </span>
      <div className="flex-1 h-px bg-slate-800" />
    </div>
  )
}

function ReplyBlock({ message }: { message: ChatMessage }) {
  const m = message
  if (!m.reply_to || !m.reply_to_author) return null
  const raw = m.reply_to_content || ''
  const isImageReply = hasImageMarker(raw)
  const att = !isImageReply ? getAttachmentMarker(raw) : null
  const caption = isImageReply ? (extractImagesCaption(raw) || extractImageCaption(raw)) : null
  return (
    <div className="flex items-start gap-2 pl-2 py-0.5 mb-1 border-l-2 border-indigo-500/40">
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-semibold text-indigo-400/80">{m.reply_to_author}</span>
        {caption && <p className="text-[12px] text-slate-400 truncate">{caption}</p>}
        {isImageReply ? (() => {
          const urls = extractImageUrls(raw)
          const toUrl = (u: string) => u.startsWith('data:') ? u : `/api/chat/attachments/${u}`
          if (urls.length > 1) {
            const thumbs = urls.slice(0, 3).map(toUrl)
            return (
              <div className="flex gap-1 mt-0.5">
                {thumbs.map((u, i) => (<img key={i} src={u} alt="" className="h-10 w-10 rounded object-cover" loading="lazy" />))}
                {urls.length > 3 && <div className="h-10 w-10 rounded bg-slate-800 flex items-center justify-center text-[10px] text-slate-400 font-medium">+{urls.length - 3}</div>}
              </div>
            )
          }
          const single = urls.length === 1 ? toUrl(urls[0]) : (() => { const e = extractImageUrl(raw); return e ? toUrl(e) : null })()
          return single ? <img src={single} alt="" className="h-10 w-10 rounded object-cover mt-0.5" loading="lazy" /> : null
        })() : att?.kind === 'voicenote' ? (
          <div className="mt-0.5"><VoiceNotePlayer noteId={att.id} /></div>
        ) : att?.kind === 'audio' ? (
          <div className="mt-0.5"><AudioWaveform src={`/api/chat/attachments/${att.id}`} /></div>
        ) : att ? (
          <p className="text-[12px] text-slate-400 truncate">📎 {att.kind}</p>
        ) : raw && <p className="text-[13px] text-slate-400 truncate">{raw}</p>}
      </div>
    </div>
  )
}

function ForwardedBlock({ message }: { message: ChatMessage }) {
  const m = message
  if (!m.forwarded_from) return null
  return (
    <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-500 select-none">
      <CornerUpRight className="w-3 h-3 text-slate-500 shrink-0" />
      <span>Reenviado de <span className="text-slate-400 font-medium">{m.forwarded_from.channel_name}</span></span>
      <span className="text-slate-600">·</span>
      <span className="text-slate-400">@{m.forwarded_from.display_name}</span>
    </div>
  )
}

function ContentBlock({ message, members, isOwn, onVideoFloat, onVideoPlay, onVideoRef, floatingVideo }: {
  message: ChatMessage; members?: { id: number; display_name: string }[]; isOwn: boolean
  onVideoFloat?: (id: string) => void; onVideoPlay?: (id: string) => void; onVideoRef?: (id: string, el: HTMLVideoElement | null) => void; floatingVideo?: string | null
}) {
  const m = message
  if (m.hidden) {
    return <span className="text-slate-500 italic line-through text-sm">{m.content === '[eliminado]' ? '[eliminado]' : '[mensaje oculto]'}</span>
  }
  const att = getAttachmentMarker(m.content)
  if (att) {
    const caption = extractImageCaption(m.content)
    if (att.kind === 'voicenote') return <VoiceNotePlayer noteId={att.id} />
    return <>{caption && <RichText text={caption} members={members} isOwn={isOwn} />}<AttachmentCard attachmentId={att.id} onFloat={onVideoFloat} onVideoPlay={onVideoPlay} onVideoRef={onVideoRef} floatingVideo={floatingVideo} /></>
  }
  if (hasImageMarker(m.content)) return null
  return <RichText text={m.content} members={members} isOwn={isOwn} />
}

function ActionRow({ m, nick, handleTouchStart, clearTouchTimer, onContextMenu }: {
  m: ChatMessage; nick: string; handleTouchStart: (e: React.TouchEvent) => void
  clearTouchTimer: () => void; onContextMenu?: (msg: ChatMessage, x: number, y: number) => void
}) {
  return (
    <div
      id={`msg-${m.id}`}
      className="group/msg flex gap-2 px-4 py-0.5 items-start select-none"
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(m, e.clientX, e.clientY) }}
      onTouchStart={handleTouchStart}
      onTouchMove={clearTouchTimer}
      onTouchEnd={clearTouchTimer}
    >
      <div className="flex-1 min-w-0 max-w-full">
        <ForwardedBlock message={m} />
        <div className="text-[15px] sm:text-sm italic text-slate-400">
          <span className="not-italic font-semibold" style={{ color: getNickColor(nick) }}>
            * {nick}
          </span>{' '}
          <span key={m.id}>
            {m.hidden ? (
              <span className="text-slate-500 not-italic line-through text-sm">
                {m.content === '[eliminado]' ? '[eliminado]' : '[mensaje oculto]'}
              </span>
            ) : (
              inlineMarkdown(m.content)
            )}{' '}
          </span>
          {'*'}
        </div>
      </div>
    </div>
  )
}

function ImageRow({ m, nick, isOwn, showHeader, handleTouchStart, clearTouchTimer, onContextMenu, onImageOpen }: {
  m: ChatMessage; nick: string; isOwn: boolean; showHeader: boolean
  handleTouchStart: (e: React.TouchEvent) => void; clearTouchTimer: () => void
  onContextMenu?: (msg: ChatMessage, x: number, y: number) => void
  onImageOpen?: (images: string[], index: number) => void
}) {
  const multi = extractImageUrls(m.content)
  let allImages: string[] = []
  let galleryCaption: string | null = null
  if (multi.length > 0) {
    allImages = multi.map((raw: string) => raw.startsWith('data:') ? raw : `/api/chat/attachments/${raw}`)
    galleryCaption = extractImagesCaption(m.content)
  } else {
    const raw = extractImageUrl(m.content)
    if (raw) {
      allImages = [raw.startsWith('data:') ? raw : `/api/chat/attachments/${raw}`]
      galleryCaption = extractImageCaption(m.content)
    }
  }
  if (allImages.length === 0) return null

  return (
    <div
      id={`msg-${m.id}`}
      className={`group/msg flex items-start gap-1.5 px-4 py-0.5 select-none ${isOwn ? 'justify-end' : ''}`}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(m, e.clientX, e.clientY) }}
      onTouchStart={handleTouchStart}
      onTouchMove={clearTouchTimer}
      onTouchEnd={clearTouchTimer}
    >
      <div className={`flex flex-col max-w-[75%] sm:max-w-[65%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {showHeader && (
          <div className="text-[11px] font-semibold mb-0.5" style={{ color: getNickColor(nick) }}>
            {nick}
          </div>
        )}
        <div className="space-y-1.5">
          <ForwardedBlock message={m} />
          <ReplyBlock message={m} />
          {galleryCaption && (
            <div className="text-sm leading-snug text-slate-100 break-words">
              {galleryCaption}
            </div>
          )}
          {allImages.length === 1 ? (
            <ImagePreview dataUrl={allImages[0]} onOpen={() => onImageOpen!(allImages, 0)} />
          ) : (
            <ImageGallery images={allImages} onOpen={(idx) => onImageOpen!(allImages, idx)} />
          )}
        </div>
        <span className="text-[10px] text-slate-500 tabular-nums mt-0.5 px-1 opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100">
          {formatTime(m.created_at * 1000)}
        </span>
      </div>
    </div>
  )
}

function BubbleMessage({ m, nick, isOwn, showHeader, isNew, members, nickByUserId, myUserId, onLinkOpen, onToggleReaction, onVideoFloat, onVideoPlay, onVideoRef, floatingVideo, handleTouchStart, clearTouchTimer, onContextMenu }: {
  m: ChatMessage; nick: string; isOwn: boolean; showHeader: boolean; isNew: boolean
  members?: { id: number; display_name: string }[]
  nickByUserId?: Map<number, string>; myUserId?: number | null
  onLinkOpen?: (url: string) => void
  onToggleReaction?: (messageId: number, emoji: string) => void
  onVideoFloat?: (attachmentId: string) => void; onVideoPlay?: (attachmentId: string) => void
  onVideoRef?: (attachmentId: string, el: HTMLVideoElement | null) => void; floatingVideo?: string | null
  handleTouchStart: (e: React.TouchEvent) => void; clearTouchTimer: () => void
  onContextMenu?: (msg: ChatMessage, x: number, y: number) => void
}) {
  const bubbleClass = isOwn
    ? 'rounded-2xl bg-indigo-800 text-slate-50 shadow-bubble-own w-full transition-shadow hover:shadow-lg'
    : 'rounded-2xl bg-slate-800/70 text-slate-100 shadow-bubble w-full transition-shadow hover:shadow-lg'
  const headerClass = isOwn
    ? 'px-3 pt-1 pb-0.5 text-[11px] font-semibold opacity-80 border-b border-white/10'
    : 'px-3 pt-1 pb-0.5 text-[11px] font-semibold border-b border-slate-700/50'
  const headerStyle = isOwn ? undefined : { color: getNickColor(nick) }
  const containerClass = isOwn
    ? 'flex flex-col items-end max-w-[75%] sm:max-w-[65%] min-w-0'
    : 'flex flex-col items-start max-w-[75%] sm:max-w-[65%] min-w-0'
  const outerClass = isOwn
    ? `group/msg flex items-start gap-1.5 px-4 py-0.5 justify-end select-none${isNew ? ' animate-slide-up-fade-in' : ''}`
    : `group/msg flex items-start gap-1.5 px-4 py-0.5 select-none${isNew ? ' animate-slide-up-fade-in' : ''}`
  const linkContainerClass = isOwn
    ? 'max-w-[75%] sm:max-w-[65%] flex flex-col items-end gap-1.5'
    : 'mt-1.5 flex flex-col items-start gap-1.5'

  return (
    <div
      id={`msg-${m.id}`}
      className={outerClass}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(m, e.clientX, e.clientY) }}
      onTouchStart={handleTouchStart}
      onTouchMove={clearTouchTimer}
      onTouchEnd={clearTouchTimer}
    >
      <div className={containerClass}>
        <div className={bubbleClass}>
          {showHeader && (
            <div className={headerClass} style={headerStyle}>
              {nick}
            </div>
          )}
          <div className="px-3 py-1 text-[15px] sm:text-sm leading-relaxed">
            <div key={m.id}>
              <ForwardedBlock message={m} />
              <ReplyBlock message={m} />
              <ContentBlock message={m} members={members} isOwn={isOwn} onVideoFloat={onVideoFloat} onVideoPlay={onVideoPlay} onVideoRef={onVideoRef} floatingVideo={floatingVideo} />
              {m.reactions && m.reactions.length > 0 && nickByUserId && (
                <MessageReactions
                  reactions={m.reactions}
                  myUserId={myUserId ?? null}
                  nickByUserId={nickByUserId}
                  onToggle={(emoji) => onToggleReaction?.(m.id, emoji)}
                />
              )}
            </div>
          </div>
        </div>
        {onLinkOpen && m.og_data && (
          <div className={linkContainerClass}>
            <LinkPreview key={`og-${m.id}`} og={m.og_data} onOpen={onLinkOpen} />
          </div>
        )}
        <span className="text-[10px] text-slate-500 tabular-nums mt-0.5 px-1 opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100">
          {formatTime(m.created_at * 1000)}
        </span>
      </div>
    </div>
  )
}

function MessageRow({
  message, isOwn, showHeader, isNew, members, nickByUserId, myUserId, onImageOpen, onLinkOpen,
  onContextMenu, onToggleReaction, onVideoFloat, onVideoPlay, onVideoRef, floatingVideo,
}: {
  message: ChatMessage
  isOwn: boolean
  showHeader: boolean
  isNew: boolean
  members?: { id: number; display_name: string }[]
  nickByUserId?: Map<number, string>
  myUserId?: number | null
  onImageOpen?: (images: string[], index: number) => void
  onLinkOpen?: (url: string) => void
  onContextMenu?: (msg: ChatMessage, x: number, y: number) => void
  onToggleReaction?: (messageId: number, emoji: string) => void
  onVideoFloat?: (attachmentId: string) => void
  onVideoPlay?: (attachmentId: string) => void
  onVideoRef?: (attachmentId: string, el: HTMLVideoElement | null) => void
  floatingVideo?: string | null
}) {
  const m = message
  const nick = nickByUserId?.get(m.user_id) ?? m.display_name

  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTouchTimer = useCallback(() => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current)
      touchTimerRef.current = null
    }
  }, [])
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    clearTouchTimer()
    touchTimerRef.current = setTimeout(() => {
      const touch = e.touches[0]
      onContextMenu?.(m, touch.clientX, touch.clientY)
    }, 400)
  }, [m, onContextMenu, clearTouchTimer])

  const isAction = !!m.is_action
  const isImage = hasImageMarker(m.content)

  if (isAction) {
    return <ActionRow m={m} nick={nick} handleTouchStart={handleTouchStart} clearTouchTimer={clearTouchTimer} onContextMenu={onContextMenu} />
  }

  if (isImage && onImageOpen) {
    return <ImageRow m={m} nick={nick} isOwn={isOwn} showHeader={showHeader} handleTouchStart={handleTouchStart} clearTouchTimer={clearTouchTimer} onContextMenu={onContextMenu} onImageOpen={onImageOpen} />
  }

  return <BubbleMessage m={m} nick={nick} isOwn={isOwn} showHeader={showHeader} isNew={isNew} members={members} nickByUserId={nickByUserId} myUserId={myUserId} onLinkOpen={onLinkOpen} onToggleReaction={onToggleReaction} onVideoFloat={onVideoFloat} onVideoPlay={onVideoPlay} onVideoRef={onVideoRef} floatingVideo={floatingVideo} handleTouchStart={handleTouchStart} clearTouchTimer={clearTouchTimer} onContextMenu={onContextMenu} />
}

export default function MessageList({
  messages, currentNick, channelName, channelMembers, nickByUserId, myUserId, myRole, onToggleReaction,
  onLoadMore, loadingMore, hasMore, onReply, onBuzz, onCopyText, onForward, onHide, onDelete,
  onVideoFloat, onVideoPlay, onVideoRef, floatingVideo,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null)
  const prevChannelRef = useRef(channelName)
  // Set to true once the first scroll-to-bottom for this mount
  // has happened. Without it, a hard reload would never
  // scroll because prevChannelRef was seeded with the same
  // channel name and the channel-change effect no-ops.
  const didInitialScrollRef = useRef(false)
  // Guard so we only fire one load-more per scroll-up gesture.
  const loadingRef = useRef(false)
  // Track which message IDs have already appeared so new
  // ones get the slide-up-fade-in animation on mount.
  const seenIdsRef = useRef<Set<number>>(new Set())
  const { menu: contextMenu, setMenu: setContextMenu, close: closeContextMenu } = useContextMenuState()
  const items = buildDisplayList(messages, currentNick, nickByUserId ?? new Map())

  // Combine the explicit channel members list with whatever
  // sender nicks we've seen in messages. The members endpoint
  // doesn't fire on every WS message, so a fast-typing user
  // would otherwise miss the @mention highlight until the
  // next member refresh.
  const members = useMemo(() => {
    const seen = new Map<number, string>()
    for (const m of channelMembers ?? []) seen.set(m.id, m.display_name)
    if (nickByUserId) for (const [id, nick] of nickByUserId) seen.set(id, nick)
    return Array.from(seen, ([id, display_name]) => ({ id, display_name }))
  }, [channelMembers, nickByUserId])

  // Initial scroll: when the channel changes (or on first
  // mount once messages have loaded), jump to the bottom.
  // useLayoutEffect so the jump happens before paint — without
  // it, the user briefly sees the list at scrollTop=0 before
  // it snaps down. The follow-up rAF catches late layout
  // (images, etc.) that would otherwise leave a gap.
  useLayoutEffect(() => {
    let raf1: number | null = null
    const scroll = () => {
      const el = containerRef.current
      if (el) el.scrollTop = el.scrollHeight
      bottomRef.current?.scrollIntoView({ block: 'end' })
    }
    if (prevChannelRef.current !== channelName) {
      // Channel switched: jump to the bottom of the new list.
      prevChannelRef.current = channelName
      didInitialScrollRef.current = false
      seenIdsRef.current = new Set()
      setAtBottom(true)
      scroll()
      raf1 = requestAnimationFrame(() => requestAnimationFrame(scroll))
    } else if (!didInitialScrollRef.current && items.length > 0) {
      // Same channel as last time (or first mount after
      // reload). Once we have messages, jump to the bottom so
      // the most recent message is visible.
      didInitialScrollRef.current = true
      scroll()
      raf1 = requestAnimationFrame(() => requestAnimationFrame(scroll))
    }
    return () => {
      if (raf1 !== null) cancelAnimationFrame(raf1)
    }
  }, [channelName, items.length])

  // Auto-scroll on new messages — but only if the user was
  // already near the bottom when the message landed. Reading
  // history (scrolling up) must not yank the view down.
  // The exception: messages from the local user are always
  // intentional, so we always scroll to the bottom for them,
  // even if the user has scrolled up to read history. Without
  // this, a tall image sent just before a follow-up text would
  // leave the text invisible (the image inflates the container
  // height and the next send never auto-scrolls because
  // atBottom is now false).
  //
  // We fire two scrolls: one synchronously in useLayoutEffect
  // (before paint, so the user never sees a wrong scroll
  // position), and a second one via a double rAF to catch
  // any layout that resolves after the first scroll — image
  // intrinsic sizes, font swap, etc. The two-stage approach
  // is what makes the snap feel correct even for messages
  // that include tall attachments.
  //
  // Detection key: the last message's ID. With one bubble per
  // message, every new message creates a new row, so items.length
  // grows on every send — but using the ID directly is still the
  // most precise signal.
  const lastId = messages.length > 0 ? messages[messages.length - 1].id : null
  const lastIsOwn = lastId !== null
    && messages.length > 0
    && (messages[messages.length - 1].user_id === myUserId)
  const prevLastIdRef = useRef<number | null>(lastId)
  useLayoutEffect(() => {
    const isNew = lastId !== null && lastId !== prevLastIdRef.current
    prevLastIdRef.current = lastId
    if (!isNew) return
    if (!atBottom && !lastIsOwn) return
    // Synchronous first scroll: put the new message at the
    // bottom of the visible area before the browser paints,
    // so there's no flash of off-screen content.
    const el = containerRef.current
    if (el) {
      // Belt-and-suspenders: scrollIntoView for the sentinel
      // AND a direct scrollTop write to the container. Some
      // browsers/layouts don't trigger scrollIntoView if the
      // sentinel is already "visible" per its own geometry
      // but the container itself is at scrollTop=0.
      bottomRef.current?.scrollIntoView({ block: 'end' })
      el.scrollTop = el.scrollHeight
    }
    // Deferred second scroll: catches any layout that
    // resolves after the first scroll (images loading,
    // markdown rendering, etc.). Two rAFs because the first
    // rAF fires before the new commit's layout is fully
    // resolved in some browsers.
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el2 = containerRef.current
        if (el2) el2.scrollTop = el2.scrollHeight
        bottomRef.current?.scrollIntoView({ block: 'end' })
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
    }
  }, [lastId, atBottom, lastIsOwn, myUserId])

  // Reactively follow scrollHeight changes while the user is
  // "at bottom" (or for their own messages). This catches
  // late-loading images, cached-media re-renders, and any
  // other dynamic content that inflates the container after
  // the initial scroll-to-bottom already ran.
  const atBottomRef = useRef(true)
  atBottomRef.current = atBottom
  const lastIsOwnRef = useRef(false)
  lastIsOwnRef.current = lastIsOwn
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const follow = atBottomRef.current || lastIsOwnRef.current
      if (follow) {
        bottomRef.current?.scrollIntoView({ block: 'end' })
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    // A bit of buffer (120px) so a single message's height
    // doesn't push the user out of "at bottom" before we
    // scroll them to the new last line.
    setAtBottom(distance < 120)
    // Trigger infinite scroll-up when the user is near the top
    // and we still have more history to load.
    if (
      onLoadMore &&
      !loadingRef.current &&
      el.scrollTop < 120
    ) {
      loadingRef.current = true
      const oldHeight = el.scrollHeight
      Promise.resolve(onLoadMore())
        .catch(() => {})
        .finally(() => {
          loadingRef.current = false
          // After the new messages render, the scrollHeight grows.
          // Bump scrollTop by the delta so the user's view stays
          // anchored on the same first visible message.
          requestAnimationFrame(() => {
            const newHeight = el.scrollHeight
            const delta = newHeight - oldHeight
            if (delta > 0) el.scrollTop = el.scrollTop + delta
          })
        })
    }
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }

  function openLink(url: string) {
    // External links open in a new tab. Using rel=noopener keeps
    // the chat safe from window.opener attacks.
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex-1 relative overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="absolute inset-0 overflow-y-auto py-2"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm gap-2">
            <span className="text-3xl opacity-30">💬</span>
            <span>No hay mensajes aún. Sé el primero.</span>
          </div>
        )}
        {loadingMore && (
          <div className="flex justify-center py-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
              cargando mensajes anteriores…
            </span>
          </div>
        )}
        {!hasMore && messages.length > 0 && (
          <div className="flex justify-center py-3 text-[11px] text-slate-600">
            — inicio del canal —
          </div>
        )}
        {items.map((item, idx) => {
          if (item.type === 'day') {
            return <DayDivider key={`d-${idx}`} ts={item.message.created_at * 1000} />
          }
          const id = item.message.id
          const isNew = didInitialScrollRef.current && !seenIdsRef.current.has(id)
          if (isNew) seenIdsRef.current.add(id)
          // Show header on the first visible bubble, whenever the author
          // changes, when the message type changes, or after 5 min of
          // inactivity from the same author.
          const prev = idx > 0 ? items[idx - 1] : null
          const showHeader = !prev || prev.type !== 'bubble'
            || prev.message.user_id !== item.message.user_id
            || !!prev.message.is_action !== !!item.message.is_action
            || hasImageMarker(prev.message.content) !== hasImageMarker(item.message.content)
            || item.message.created_at - prev.message.created_at > HEADER_INTERVAL_S
          return (
            <MessageRow
              key={`b-${id}`}
              message={item.message}
              showHeader={showHeader}
              isOwn={item.isOwn}
              isNew={isNew}
              members={members}
              nickByUserId={nickByUserId}
              myUserId={myUserId}
              onImageOpen={(images, idx) => setLightbox({ images, index: idx })}
              onLinkOpen={openLink}
              onContextMenu={(msg, x, y) => setContextMenu({ show: true, x, y, message: msg, isOwn: item.isOwn })}
              onToggleReaction={onToggleReaction}
              onVideoFloat={onVideoFloat}
              onVideoPlay={onVideoPlay}
              onVideoRef={onVideoRef}
              floatingVideo={floatingVideo}
            />
          )
        })}
        <div ref={bottomRef} className="h-1" />
      </div>
      {!atBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 sm:right-6 w-9 h-9 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg flex items-center justify-center transition-colors z-10"
          aria-label="Ir al final"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          index={lightbox.index}
          onIndexChange={(i) => setLightbox(prev => prev ? { ...prev, index: i } : null)}
          onClose={() => setLightbox(null)}
        />
      )}
      <MessageContextMenu
        state={contextMenu}
        onClose={closeContextMenu}
        onReact={(messageId, emoji) => {
          onToggleReaction?.(messageId, emoji)
          closeContextMenu()
        }}
        onReply={(msg) => onReply?.(msg)}
        onForward={(msg) => onForward?.(msg)}
        onBuzz={(targetUserId) => onBuzz?.(targetUserId)}
        onCopyText={(text) => onCopyText?.(text)}
        myRole={myRole}
        onHide={onHide}
        onDelete={onDelete}
      />
    </div>
  )
}
