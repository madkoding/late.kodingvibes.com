import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { X, Paperclip, Smile, ArrowUp, Trash2, Image as ImageIcon, FileText, Music, Video, MessageSquareQuote, Upload, Plus, Mic } from 'lucide-react'
import type { ChannelMember, ChatMessage } from '../../lib/chat/domain/types'
import { prepareImageForChat } from '../../lib/image-prep'
import { hasImageMarker, extractImageUrl } from '../../lib/chat/domain/parsers'
import EmojiPicker from './EmojiPicker'
import AudioWaveform from './AudioWaveform'

const MAX_AUDIO_DURATION_MS = 5 * 60 * 1000

interface MessageInputProps {
  onSend: (text: string) => void
  onTyping?: () => void
  disabled: boolean
  placeholder?: string
  channelMembers: ChannelMember[]
  onSearchUsers: (q: string) => Promise<Array<{ id: number; display_name: string; email: string }>>
  onInviteUser: (channelId: number, email: string) => Promise<{ ok: boolean; user?: { id: number; display_name: string } }>
  channelId: number | null
  onInviteConfirm: (user: { display_name: string; email: string }) => void
  /** Called to upload a file. Returns the attachment metadata. */
  onUploadFile?: (channelId: number, file: File) => Promise<{ id: string; url: string; kind: string }>
  /** Called when an attachment is uploaded and ready to be sent as a message. */
  onSendAttachment?: (channelId: number, kind: string, attachmentId: string, caption?: string) => Promise<void>
  /** Called when an upload or other operation fails. Shows a toast on the parent. */
  onError?: (msg: string) => void
  /** The message being replied to, if any. */
  replyContext?: ChatMessage | null
  /** Clear the reply context. */
  onClearReply?: () => void
}

interface Command {
  cmd: string
  desc: string
}

const COMMANDS: Command[] = [
  { cmd: '/me', desc: 'Enviar un mensaje de acción' },
  { cmd: '/topic', desc: 'Cambiar el tema del canal' },
  { cmd: '/clear', desc: 'Limpiar el chat' },
  { cmd: '/help', desc: 'Mostrar ayuda' },
]

function ReplyBar({ reply, onClear }: { reply: ChatMessage; onClear: () => void }) {
  const content = hasImageMarker(reply.content) ? (() => {
    let url: string | null = null
    const urls = extractImageUrl(reply.content)
    if (urls) {
      url = urls.startsWith('data:') ? urls : `/api/chat/attachments/${urls}`
    }
    if (!url) {
      try {
        const arr = JSON.parse(reply.content.slice(reply.content.indexOf('__late_images__:') + 16))
        if (Array.isArray(arr) && arr.length > 0) {
          const first = arr[0]
          url = first.startsWith('data:') ? first : `/api/chat/attachments/${first}`
        }
      } catch {}
    }
    return url ? <img src={url} alt="" className="h-8 rounded object-cover shrink-0" /> : <span className="text-slate-400 truncate italic">[imagen]</span>
  })() : (
    <span className="text-slate-400 truncate">{reply.content.slice(0, 120)}</span>
  )
  return (
    <div className="px-3 py-1.5 bg-slate-900 border-t border-slate-800 flex items-center gap-2 text-sm">
      <MessageSquareQuote className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
      <span className="text-indigo-300 font-medium truncate shrink-0">{reply.display_name}</span>
      {content}
      <button onClick={onClear} className="ml-auto shrink-0 w-5 h-5 rounded-full hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-100 transition-colors" aria-label="Cancelar respuesta">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function InviteModal({
  user, onClose, onConfirm,
}: {
  user: { display_name: string; email: string }
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl bg-slate-900 border-slate-800">
        <h2 className="text-lg font-semibold text-slate-100 mb-2">¿Invitar a {user.display_name}?</h2>
        <p className="text-sm text-slate-400 mb-6">{user.display_name} no está en este canal. ¿Quieres agregarlo?</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm font-medium">No</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-semibold transition-colors text-sm">Sí, invitar</button>
        </div>
      </div>
    </div>
  )
}

export interface MessageInputHandle {
  focus: () => void
  insertText: (text: string) => void
}

const MessageInput = forwardRef<MessageInputHandle, MessageInputProps>(function MessageInput({
  onSend,
  onTyping,
  disabled,
  placeholder,
  channelMembers,
  onSearchUsers,
  onInviteUser,
  channelId,
  onInviteConfirm,
  onUploadFile,
  onSendAttachment,
  onError,
  replyContext,
  onClearReply,
}, ref) {
  const [text, setText] = useState('')
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showClipMenu, setShowClipMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const [suggestions, setSuggestions] = useState<Array<{ id?: number; display_name: string; email?: string; isExternal?: boolean }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [trigger, setTrigger] = useState<'@' | '/' | null>(null)
  const [triggerStart, setTriggerStart] = useState(0)
  const [pendingInvite, setPendingInvite] = useState<{ display_name: string; email: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [pendingFileKind, setPendingFileKind] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [isFileDragging, setIsFileDragging] = useState(false)
  const dragCounterRef = useRef(0)
  const internalDragRef = useRef(false)
  const isFileDraggingRef = useRef(false)

  // Recording state
  const [recording, setRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelRef = useRef(false)
  // Ref mirror of `recording` so the pointer handlers always
  // see the latest value without needing the state in their
  // closure (which would re-bind them on every render).
  const recordingRef = useRef(false)
  recordingRef.current = recording
  // Long-press timer for push-to-talk on the send button.
  // 200ms is short enough to feel intentional but long
  // enough to not fire on an accidental tap.
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFiredRef = useRef(false)

  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus({ preventScroll: true })
    },
    insertText: (insert: string) => {
      const ta = textareaRef.current
      if (!ta) {
        setText(prev => prev + insert)
        return
      }
      const pos = ta.selectionStart ?? text.length
      const before = text.slice(0, pos)
      const after = text.slice(pos)
      const newText = before + insert + after
      setText(newText)
      requestAnimationFrame(() => {
        ta.focus()
        const newPos = pos + insert.length
        ta.setSelectionRange(newPos, newPos)
      })
    },
  }), [text])

  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus({ preventScroll: true })
    }
  }, [disabled])

  const lastTypingAtRef = useRef(0)
  const handleTypingBroadcast = useCallback(() => {
    if (!onTyping) return
    const now = Date.now()
    if (now - lastTypingAtRef.current < 3000) return
    lastTypingAtRef.current = now
    onTyping()
  }, [onTyping])

  const handleImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return
    if (file.size > 20_000_000) return
    const prepared = await prepareImageForChat(file)
    if (prepared) setPendingImages(prev => {
      if (prev.length >= 20) return prev
      const dup = prev.some(p => p.startsWith(prepared.dataUrl.slice(0, 80)))
      if (dup) return prev
      return [...prev, prepared.dataUrl]
    })
  }, [])

  const MAX_UPLOAD_BYTES = 60_000_000

  const handleFileSelect = useCallback(async (file: File, kind: string) => {
    if (kind === 'image') {
      await handleImageFile(file)
      return
    }
    if (channelId === null || !onUploadFile || !onSendAttachment) return
    if (file.size > MAX_UPLOAD_BYTES) {
      const mb = Math.round(file.size / (1024 * 1024))
      onError?.(`${kind === 'video' ? 'Video' : 'Archivo'} demasiado grande (${mb} MB, máx 60 MB)`)
      return
    }
    setUploading(true)
    try {
      const attachment = await onUploadFile(channelId, file)
      await onSendAttachment(channelId, kind, attachment.id)
    } catch (err: any) {
      onError?.(`No se pudo subir el ${kind === 'video' ? 'video' : 'archivo'}: ${err.message || 'Error desconocido'}`)
    } finally {
      setUploading(false)
    }
  }, [channelId, onUploadFile, onSendAttachment, handleImageFile, onError])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const cd = e.clipboardData
      if (!cd) return
      const fromFiles = cd.files
      if (fromFiles && fromFiles.length > 0) {
        const images: File[] = []
        for (let i = 0; i < fromFiles.length; i++) {
          const f = fromFiles[i]
          if (f && f.type.startsWith('image/')) images.push(f)
        }
        if (images.length > 0) {
          e.preventDefault()
          for (const f of images) void handleFileSelect(f, 'image')
          return
        }
      }
      const items = cd.items
      if (items) {
        const imageFiles: File[] = []
        for (let i = 0; i < items.length; i++) {
          const it = items[i]
          if (it.kind !== 'file') continue
          const file = it.getAsFile()
          if (!file) continue
          if (file.type && !file.type.startsWith('image/')) continue
          imageFiles.push(file)
        }
        if (imageFiles.length > 0) {
          e.preventDefault()
          for (const f of imageFiles) void handleFileSelect(f, 'image')
        }
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [handleFileSelect])

  // ---- Drag-and-drop overlay (document-level) ----
  function inferKind(file: File): string {
    if (file.type.startsWith('image/')) return 'image'
    if (file.type.startsWith('audio/')) return 'audio'
    if (file.type.startsWith('video/')) return 'video'
    return 'document'
  }

  useEffect(() => {
    if (channelId === null) return

    const onDragStart = (e: DragEvent) => {
      const types = e.dataTransfer?.types
      internalDragRef.current = types ? !Array.from(types).includes('Files') : true
    }

    const onDragEnd = () => {
      internalDragRef.current = false
      dragCounterRef.current = 0
      isFileDraggingRef.current = false
      setIsFileDragging(false)
    }

    const onDragEnter = (e: DragEvent) => {
      if (internalDragRef.current) return
      const types = e.dataTransfer?.types
      if (!types || !Array.from(types).includes('Files')) return
      dragCounterRef.current++
      if (dragCounterRef.current === 1) {
        isFileDraggingRef.current = true
        setIsFileDragging(true)
      }
    }

    const onDragLeave = () => {
      if (internalDragRef.current) return
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
      if (dragCounterRef.current === 0) {
        isFileDraggingRef.current = false
        setIsFileDragging(false)
      }
    }

    const onDragOver = (e: DragEvent) => {
      const types = e.dataTransfer?.types
      if (types && Array.from(types).includes('Files')) e.preventDefault()
    }

    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current = 0
      isFileDraggingRef.current = false
      setIsFileDragging(false)
      internalDragRef.current = false
      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return
      for (const f of Array.from(files)) {
        void handleFileSelect(f, inferKind(f))
      }
    }

    document.addEventListener('dragstart', onDragStart)
    document.addEventListener('dragend', onDragEnd)
    document.addEventListener('dragenter', onDragEnter)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragstart', onDragStart)
      document.removeEventListener('dragend', onDragEnd)
      document.removeEventListener('dragenter', onDragEnter)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('drop', onDrop)
    }
  }, [channelId, handleFileSelect])

  // Close the mobile "+" menu on outside click/tap.
  useEffect(() => {
    if (!showMobileMenu) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setShowMobileMenu(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [showMobileMenu])

  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.min(ta.scrollHeight, 144) + 'px'
    }
  }, [text])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    const pos = ta.selectionStart || 0
    const before = text.slice(0, pos)
    const atMatch = before.match(/(^|\s)@(\w*)$/)
    const slashMatch = before.match(/^\/(\w*)$/)
    if (atMatch) {
      const query = atMatch[2]
      setTrigger('@')
      setTriggerStart(pos - query.length - 1)
      if (query.length === 0) {
        const all: Array<{ display_name: string; isExternal?: boolean }> = []
        // Add mass mentions for admin/mod
        all.push({ display_name: '@todos', isExternal: true })
        all.push({ display_name: '@here', isExternal: true })
        all.push(...channelMembers.map(m => ({ id: m.id, display_name: m.display_name, email: m.email })))
        setSuggestions(all as any)
        setShowSuggestions(all.length > 0)
        setActiveIdx(0)
      } else {
        const lowerQ = query.toLowerCase()
        const localMatches = channelMembers
          .filter(m => m.display_name.toLowerCase().includes(lowerQ))
          .map(m => ({ id: m.id, display_name: m.display_name, email: m.email, isExternal: false }))
        onSearchUsers(query).then(globalMatches => {
          const seen = new Set(localMatches.map(m => m.display_name.toLowerCase()))
          const external = globalMatches
            .filter(m => !seen.has(m.display_name.toLowerCase()))
            .map(m => ({ ...m, isExternal: true }))
          const all = [...localMatches, ...external]
          setSuggestions(all)
          setShowSuggestions(all.length > 0)
          setActiveIdx(0)
        }).catch(() => {
          setSuggestions(localMatches)
          setShowSuggestions(localMatches.length > 0)
          setActiveIdx(0)
        })
      }
    } else if (slashMatch && channelId !== null) {
      const query = slashMatch[1]
      setTrigger('/')
      setTriggerStart(1)
      const lowerQ = query.toLowerCase()
      const matches = COMMANDS.filter(c => c.cmd.toLowerCase().includes(lowerQ) || c.cmd.slice(1).startsWith(lowerQ))
      setSuggestions(matches.map(c => ({ display_name: `${c.cmd} ${c.desc}` })))
      setShowSuggestions(matches.length > 0)
      setActiveIdx(0)
    } else {
      setShowSuggestions(false)
      setTrigger(null)
    }
  }, [text, channelMembers, channelId, onSearchUsers])

  const insertSuggestion = (s: { display_name: string; isExternal?: boolean; email?: string }) => {
    if (trigger === '@') {
      const ta = textareaRef.current
      if (!ta) return
      const pos = ta.selectionStart || 0
      const before = text.slice(0, triggerStart)
      const after = text.slice(pos)
      const insert = s.display_name.startsWith('@') ? `${s.display_name} ` : `@${s.display_name} `
      const newText = before + insert + after
      setText(newText)
      requestAnimationFrame(() => {
        if (ta) {
          const newPos = before.length + insert.length
          ta.focus()
          ta.setSelectionRange(newPos, newPos)
        }
      })
      if (s.isExternal && s.email && !s.display_name.startsWith('@')) {
        setPendingInvite({ display_name: s.display_name, email: s.email })
      }
    } else if (trigger === '/') {
      const cmd = s.display_name.split(' ')[0]
      const ta = textareaRef.current
      if (!ta) return
      const before = text.slice(0, triggerStart)
      const after = text.slice(text.indexOf(' ', triggerStart) >= 0 ? text.indexOf(' ', triggerStart) : text.length)
      const newText = before + cmd + ' ' + after
      setText(newText)
      requestAnimationFrame(() => {
        if (ta) {
          const newPos = before.length + cmd.length + 1
          ta.focus()
          ta.setSelectionRange(newPos, newPos)
        }
      })
    }
    setShowSuggestions(false)
  }

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (disabled) return
    const trimmed = text.trim()
    if (pendingImages.length > 0) {
      if (pendingImages.length === 1) {
        const payload = trimmed
          ? `${trimmed}\n__late_image__:${pendingImages[0]}`
          : `__late_image__:${pendingImages[0]}`
        onSend(payload)
      } else {
        const json = JSON.stringify(pendingImages)
        const payload = trimmed
          ? `${trimmed}\n__late_images__:${json}`
          : `__late_images__:${json}`
        onSend(payload)
      }
      setPendingImages([])
    } else if (trimmed) {
      onSend(trimmed)
    } else {
      return
    }
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  // ---- File upload handler ----
  const triggerFileInput = (kind: string) => {
    setPendingFileKind(kind)
    setShowClipMenu(false)
    // Open the file input after a tick so the kind is set
    setTimeout(() => fileInputRef.current?.click(), 0)
  }

  // ---- Recording ----
  const startRecording = useCallback(async () => {
    if (!channelId) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/mp4'
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      recorderRef.current = recorder
      chunksRef.current = []
      cancelRef.current = false
      setRecording(true)
      setRecordedBlob(null)
      setRecordedUrl(null)
      setRecordingDuration(0)

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        if (cancelRef.current) {
          setRecording(false)
          setRecordedBlob(null)
          setRecordedUrl(null)
          setRecordingDuration(0)
          return
        }
        const blob = new Blob(chunksRef.current, { type: mime })
        const url = URL.createObjectURL(blob)
        setRecordedBlob(blob)
        setRecordedUrl(url)
        setRecording(false)
      }

      recorder.start()
      const startTime = Date.now()
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime
        setRecordingDuration(elapsed)
        if (elapsed >= MAX_AUDIO_DURATION_MS) {
          recorder.stop()
          clearInterval(recordingTimerRef.current!)
          recordingTimerRef.current = null
        }
      }, 200)
    } catch (err) {
      console.error('Failed to start recording:', err)
      setRecording(false)
    }
  }, [channelId])

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }, [])

  const cancelRecording = useCallback(() => {
    cancelRef.current = true
    stopRecording()
  }, [stopRecording])

  const sendVoiceNote = useCallback(async () => {
    if (!recordedBlob || !channelId || !onUploadFile || !onSendAttachment) return
    setUploading(true)
    try {
      const file = new File([recordedBlob], `voice-${Date.now()}.webm`, { type: recordedBlob.type })
      const attachment = await onUploadFile(channelId, file)
      await onSendAttachment(channelId, 'audio', attachment.id)
      setRecordedBlob(null)
      setRecordedUrl(null)
      setRecordingDuration(0)
    } catch (err: any) {
      onError?.(`No se pudo subir el audio: ${err.message || 'Error desconocido'}`)
    } finally {
      setUploading(false)
    }
  }, [recordedBlob, channelId, onUploadFile, onSendAttachment, onError])

  const formatDuration = (ms: number) => {
    const min = Math.floor(ms / 60000)
    const sec = Math.floor((ms % 60000) / 1000)
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
      if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    }
  }, [recordedUrl])

  const insertEmoji = useCallback((name: string) => {
    const ta = textareaRef.current
    if (!ta) {
      setText(t => t + `:${name}: `)
      return
    }
    const pos = ta.selectionStart ?? text.length
    const before = text.slice(0, pos)
    const after = text.slice(pos)
    const insertion = `:${name}: `
    const newText = before + insertion + after
    setText(newText)
    requestAnimationFrame(() => {
      ta.focus()
      const newPos = pos + insertion.length
      ta.setSelectionRange(newPos, newPos)
    })
  }, [text])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => (i + 1) % suggestions.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => (i - 1 + suggestions.length) % suggestions.length); return }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); insertSuggestion(suggestions[activeIdx]); return }
      if (e.key === 'Escape') { e.preventDefault(); setShowSuggestions(false); return }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const canSend = !disabled && (text.trim().length > 0 || pendingImages.length > 0)

  return (
    <>
      {recordedUrl ? (
        <div className="px-3 py-2 border-t border-slate-800 bg-slate-950" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
          <div className="flex items-center gap-3">
            <AudioWaveform src={recordedUrl} filename="audio" />
            <button
              type="button"
              onClick={() => { setRecordedBlob(null); setRecordedUrl(null); setRecordingDuration(0) }}
              className="w-9 h-9 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 flex items-center justify-center transition-colors flex-shrink-0"
              aria-label="Descartar audio"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={sendVoiceNote}
              className="w-10 h-10 rounded-full bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-700 text-white flex items-center justify-center flex-shrink-0 transition-colors"
              aria-label="Enviar audio"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <>
      {pendingImages.length > 0 && (
        <div className="px-3 sm:px-4 pt-2 border-t border-slate-800 bg-slate-950">
          <div className="flex flex-col gap-2 p-2 rounded-lg bg-slate-900 border border-slate-700">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {pendingImages.map((url, i) => (
                <div key={i} className="relative flex-shrink-0 group">
                  <img src={url} alt="" className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-md bg-slate-950" />
                  <button
                    type="button"
                    onClick={() => setPendingImages(prev => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-800 hover:bg-red-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Quitar imagen"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {pendingImages.length > 1 && (
                <button
                  type="button"
                  onClick={() => setPendingImages([])}
                  className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-md border border-dashed border-slate-600 hover:border-red-500 text-slate-500 hover:text-red-400 flex items-center justify-center transition-colors text-[10px] font-medium"
                  aria-label="Quitar todas"
                >
                  Quitar<br />todas
                </button>
              )}
            </div>
            <span className="text-[11px] text-slate-500">{pendingImages.length} imagen{pendingImages.length !== 1 ? 'es' : ''} · Enter para enviar</span>
          </div>
        </div>
      )}
      {uploading && (
        <div className="px-3 py-1.5 text-xs text-slate-500 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Subiendo archivo…
        </div>
      )}
      {replyContext && <ReplyBar reply={replyContext} onClear={onClearReply!} />}
      {isFileDragging && channelId !== null && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-indigo-950/60 backdrop-blur-sm pointer-events-none transition-opacity duration-150">
          <div className="bg-slate-900/90 border-2 border-dashed border-indigo-400 rounded-2xl p-8 sm:p-10 max-w-md mx-4 text-center shadow-2xl">
            <Upload className="w-10 h-10 text-indigo-300 mx-auto mb-3" />
            <p className="text-slate-100 font-semibold text-lg">Suelta archivos para adjuntar</p>
            <p className="text-slate-400 text-sm mt-1">Imágenes, audio, video o documentos</p>
          </div>
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="px-3 py-2 border-t border-slate-800 bg-slate-950 relative"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-end gap-2 min-w-0">
          <input
            ref={fileInputRef}
            type="file"
            accept={
              pendingFileKind === 'image' ? 'image/*' :
              pendingFileKind === 'video' ? 'video/*' :
              pendingFileKind === 'audio' ? 'audio/*' :
              pendingFileKind === 'document' ? '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv' :
              '*/*'
            }
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleFileSelect(f, pendingFileKind || 'file')
              e.target.value = ''
            }}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files
              if (files) {
                for (let i = 0; i < files.length; i++) {
                  const f = files[i]
                  if (f) void handleFileSelect(f, 'image')
                }
              }
              e.target.value = ''
            }}
          />
          <div ref={mobileMenuRef} className="relative sm:hidden">
            <button
              type="button"
              onClick={() => setShowMobileMenu(v => !v)}
              disabled={disabled}
              className="w-10 h-10 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center flex-shrink-0 transition-colors"
              aria-label="Más opciones"
              title="Más opciones"
            >
              <Plus className="w-5 h-5" />
            </button>
            {showMobileMenu && (
              <div className="absolute bottom-full mb-1 left-0 z-40 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 w-44 select-none" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => { imageInputRef.current?.click(); setShowMobileMenu(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <ImageIcon className="w-4 h-4 text-slate-400" />
                  Imagen
                </button>
                <button
                  type="button"
                  onClick={() => { triggerFileInput('audio'); setShowMobileMenu(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Music className="w-4 h-4 text-slate-400" />
                  Audio
                </button>
                <button
                  type="button"
                  onClick={() => { triggerFileInput('video'); setShowMobileMenu(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Video className="w-4 h-4 text-slate-400" />
                  Video
                </button>
                <button
                  type="button"
                  onClick={() => { triggerFileInput('document'); setShowMobileMenu(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <FileText className="w-4 h-4 text-slate-400" />
                  Documento
                </button>
                <button
                  type="button"
                  onClick={() => { setShowEmoji(true); setShowMobileMenu(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Smile className="w-4 h-4 text-slate-400" />
                  Emoji
                </button>
              </div>
            )}
          </div>
          <div className="hidden sm:contents">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowClipMenu(v => !v)}
              disabled={disabled}
              className="w-10 h-10 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center flex-shrink-0 transition-colors"
              aria-label="Adjuntar archivo"
              title="Adjuntar archivo"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            {showClipMenu && (
              <div className="absolute bottom-full mb-1 left-0 z-40 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 w-44 select-none" onClick={(e) => e.stopPropagation()}>
                {[
                  { kind: 'audio', icon: Music, label: 'Audio' },
                  { kind: 'video', icon: Video, label: 'Video' },
                  { kind: 'document', icon: FileText, label: 'Documento' },
                ].map(item => (
                  <button
                    key={item.kind}
                    type="button"
                    onClick={() => triggerFileInput(item.kind)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <item.icon className="w-4 h-4 text-slate-400" />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={disabled}
            className="w-10 h-10 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center flex-shrink-0 transition-colors"
            aria-label="Adjuntar imagen"
            title="Adjuntar imagen"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmoji(v => !v)}
              disabled={disabled}
              className="w-10 h-10 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center flex-shrink-0 transition-colors"
              aria-label="Insertar emoji"
              title="Insertar emoji"
            >
              <Smile className="w-5 h-5" />
            </button>
            {showEmoji && (
              <EmojiPicker
                onSelect={(name) => { insertEmoji(name); setShowEmoji(false) }}
                onClose={() => setShowEmoji(false)}
              />
            )}
          </div>
          </div>
          <div className="flex-1 relative min-w-0">
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto z-40 select-none">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); insertSuggestion(s) }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 ${
                      i === activeIdx ? 'bg-indigo-500/20 text-slate-100' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {trigger === '@' ? (
                      <>
                        <span className="text-slate-500 text-xs">@</span>
                        <span className="font-medium">{s.display_name}</span>
                        {s.isExternal && !s.display_name.startsWith('@') && (
                          <span className="text-[10px] text-amber-400 ml-auto">invitar</span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="font-mono text-indigo-400">{s.display_name.split(' ')[0]}</span>
                        <span className="text-slate-500 text-xs truncate">{s.display_name.split(' ').slice(1).join(' ')}</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => { setText(e.target.value); handleTypingBroadcast() }}
              onKeyDown={(e) => { handleKeyDown(e); handleTypingBroadcast() }}
              disabled={disabled}
              placeholder={recording ? `Grabando · ${formatDuration(recordingDuration)}` : (disabled ? 'Conectando...' : placeholder || 'Escribe un mensaje...')}
              rows={1}
              enterKeyHint="send"
              className={`w-full px-3 sm:px-4 py-2.5 rounded-xl border text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition-all leading-snug resize-none overflow-y-auto max-h-36 break-words ${
                recording
                  ? 'bg-slate-950 border-rose-700/50 focus:border-rose-500 focus:ring-rose-500/30'
                  : 'bg-slate-900 border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/30'
              }`}
              style={{ minHeight: '44px', maxWidth: '100%', fontSize: '16px' }}
            />
            {text.length === 0 && !disabled && !recording && (
              <span className="hidden lg:block absolute right-3 bottom-2.5 text-[10px] text-slate-600 pointer-events-none">
                Enter para enviar · mantené para grabar audio
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={!canSend && text.trim().length === 0 && pendingImages.length === 0}
            onClick={() => {
              if (longPressFiredRef.current) {
                longPressFiredRef.current = false
                return
              }
              if (canSend) handleSubmit()
            }}
            onPointerDown={(e) => {
              if (disabled) return
              // Push-to-talk: only when there's nothing to send.
              if (text.trim().length > 0 || pendingImages.length > 0) return
              longPressFiredRef.current = false
              e.preventDefault()
              longPressTimerRef.current = setTimeout(() => {
                longPressFiredRef.current = true
                startRecording()
              }, 200)
            }}
            onPointerUp={() => {
              if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current)
                longPressTimerRef.current = null
              }
              if (recordingRef.current) stopRecording()
            }}
            onPointerLeave={() => {
              if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current)
                longPressTimerRef.current = null
              }
            }}
            onPointerCancel={() => {
              if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current)
                longPressTimerRef.current = null
              }
              if (recordingRef.current) cancelRecording()
            }}
            aria-label={canSend ? 'Enviar mensaje' : 'Mantener para grabar audio'}
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all shadow-sm self-end flex-none ${
              recording
                ? 'bg-rose-500 hover:bg-rose-400 text-white animate-pulse'
                : canSend
                  ? 'bg-indigo-500 hover:bg-indigo-400 text-white'
                  : 'bg-slate-700 text-slate-500'
            }`}
          >
            {recording ? (
              <Mic className="w-5 h-5" />
            ) : canSend ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a1 1 0 00-1.39 1.21L4.5 11 14 12 4.5 13l-2.49 6.19a1 1 0 001.39 1.21z" />
              </svg>
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>
      {pendingInvite && (
        <InviteModal
          user={pendingInvite}
          onClose={() => setPendingInvite(null)}
          onConfirm={async () => {
            if (channelId !== null) {
              const res = await onInviteUser(channelId, pendingInvite.email)
              if (res.ok) {
                onInviteConfirm(pendingInvite)
                setPendingInvite(null)
              }
            }
          }}
        />
      )}
        </>
      )}
    </>
  )
})

export default MessageInput
