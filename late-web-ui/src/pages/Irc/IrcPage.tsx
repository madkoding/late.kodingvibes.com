import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import VoiceRoomView from "@/components/irc/VoiceRoomView";
import { ChatClient } from "@/lib/irc/chat-client";
import type { SSOSession, ChannelState, ChatMessage, ChannelCategory } from "@/lib/irc/types";
import ChannelList from "@/components/irc/ChannelList";
import UserList from "@/components/irc/UserList";
import MessageList from "@/components/irc/MessageList";
import MessageInput from "@/components/irc/MessageInput";
import TypingIndicator from "@/components/irc/TypingIndicator";
import JoinChannelModal from "@/components/irc/JoinChannelModal";
import NickPromptModal from "@/components/irc/NickPromptModal";
import NotificationSettingsModal from "@/components/irc/NotificationSettingsModal";
import ManageMembersModal from "@/components/irc/ManageMembersModal";
import ForwardModal from "@/components/irc/ForwardModal";
import Drawer from "@/components/irc/Drawer";
import FloatingVideoContainer from "@/components/irc/FloatingVideo";
import MiniPlayer from "@/audio/MiniPlayer";
import { useAudio } from "@/audio/AudioProvider";
import useDocumentTitle from "@/lib/use-document-title";
import { ensureNotificationAudio, playMentionBeep, playBuzz, setVolume } from "@/lib/notification-sound";
import { formatToast, showSystemNotification, useRequestNotificationPermission } from "@/lib/chat-notifs";
import { useHeaderOffset } from "@/lib/use-header-offset";
import { Topbar } from "./Topbar";

const SESSION_KEY = "chat.session";
const CHANNEL_KEY = "chat.channel";
const SSO_URL = "https://www.kodingvibes.com/api/sso/irc-token";
const SSO_REDIRECT_COUNT_KEY = "chat.sso_redirects";
const MAX_SSO_REDIRECTS = 2;

function redirectToSso() {
  const next = Number(sessionStorage.getItem(SSO_REDIRECT_COUNT_KEY) || "0") + 1;
  sessionStorage.setItem(SSO_REDIRECT_COUNT_KEY, String(next));
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(CHANNEL_KEY);
  localStorage.removeItem("late_redirect");
  window.location.href = SSO_URL;
}

function ssoBudgetExhausted() {
  return Number(sessionStorage.getItem(SSO_REDIRECT_COUNT_KEY) || "0") >= MAX_SSO_REDIRECTS;
}

function clearSsoBudget() {
  sessionStorage.removeItem(SSO_REDIRECT_COUNT_KEY);
}

export function Irc() {
  useDocumentTitle();
  useRequestNotificationPermission();
  const audio = useAudio();
  const { headerHeight, vh } = useHeaderOffset();
  const [loading, setLoading] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  useEffect(() => {
    const unlock = () => {
      ensureNotificationAudio()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [hasMore, setHasMore] = useState<Record<number, boolean>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [showNickModal, setShowNickModal] = useState(false);
  const [showChannelsDrawer, setShowChannelsDrawer] = useState(false);
  const [showUsersDrawer, setShowUsersDrawer] = useState(false);
  const [buzzShake, setBuzzShake] = useState(false);
  const [connected, setConnected] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const tokenInvalidRef = useRef(false);
  const [nick, setNick] = useState("");
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [googleName, setGoogleName] = useState<string | null>(null);
  const [floatingVideo, setFloatingVideo] = useState<string | null>(null);
  const floatingVideoRef = useRef<string | null>(null);
  useEffect(() => { floatingVideoRef.current = floatingVideo }, [floatingVideo])
  const floatingSourceChannelRef = useRef<number | null>(null);
  const playingVideoRef = useRef<string | null>(null);
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const floatingContainerRef = useRef<HTMLDivElement>(null);
  const restoreTimeRef = useRef<{ attachmentId: string; time: number } | null>(null);

  const closeFloatingVideo = useCallback(() => {
    const container = floatingContainerRef.current
    if (container) {
      const video = container.querySelector('video')
      if (video) {
        restoreTimeRef.current = { attachmentId: floatingVideoRef.current || '', time: video.currentTime }
        video.pause()
        video.remove()
      }
    }
    setFloatingVideo(null)
    playingVideoRef.current = null
    floatingSourceChannelRef.current = null
  }, [])
  const [nickMap, setNickMap] = useState<Map<number, string>>(new Map());
  const [typing, setTyping] = useState<Map<number, number>>(new Map())
  const [replyContext, setReplyContext] = useState<ChatMessage | null>(null)
  const [forwardContext, setForwardContext] = useState<ChatMessage | null>(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [managingChannelId, setManagingChannelId] = useState<number | null>(null)
  const [activeVoiceChannelId, setActiveVoiceChannelId] = useState<number | null>(null)
  const [categories, setCategories] = useState<ChannelCategory[]>([])
  const [notifPrefs, setNotifPrefs] = useState<{ mode: 'mentions' | 'all' | 'none'; volume: number; sound: boolean; vibration: boolean; system: boolean }>(() => {
    try {
      const saved = localStorage.getItem('chat.notif_prefs')
      if (saved) return { mode: 'mentions', volume: 70, sound: true, vibration: true, system: true, ...JSON.parse(saved) }
    } catch {}
    return { mode: 'mentions', volume: 70, sound: true, vibration: true, system: true }
  })
  const notifPrefsRef = useRef(notifPrefs)
  useEffect(() => { notifPrefsRef.current = notifPrefs }, [notifPrefs])
  const [channels, setChannels] = useState<Map<number, ChannelState>>(new Map());
  const [currentChannel, setCurrentChannel] = useState<number | null>(() => {
    const v = localStorage.getItem(CHANNEL_KEY);
    return v ? Number(v) : null;
  });
  const [toasts, setToasts] = useState<{ id: string; text: string; type: string }[]>([]);
  const toastTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const clientRef = useRef<ChatClient | null>(null);
  const messageInputRef = useRef<{ focus: () => void; insertText: (text: string) => void } | null>(null);
  const voiceHandlersRef = useRef<Set<(type: string, data: any) => void>>(new Set())
  const voiceCleanupRef = useRef<(() => void) | null>(null)

  const emitVoiceMessage = useCallback((type: string, data: any) => {
    voiceHandlersRef.current.forEach(h => h(type, data))
  }, [])

  const onVoiceMessage = useCallback((handler: (type: string, data: any) => void): (() => void) => {
    voiceHandlersRef.current.add(handler)
    return () => { voiceHandlersRef.current.delete(handler) }
  }, [])
  const myUserIdRef = useRef<number | null>(null)
  const nickRef = useRef<string>("")
  const channelsRef = useRef<Map<number, ChannelState>>(new Map())
  useEffect(() => { myUserIdRef.current = myUserId }, [myUserId])
  useEffect(() => { nickRef.current = nick }, [nick])
  useEffect(() => { channelsRef.current = channels }, [channels])
  useEffect(() => { tokenInvalidRef.current = tokenInvalid }, [tokenInvalid])

  useEffect(() => {
    const tick = () => {
      setTyping(prev => {
        const now = Date.now()
        const next = new Map<number, number>()
        let changed = false
        for (const [id, t] of prev) {
          if (now - t < 6000) next.set(id, t)
          else changed = true
        }
        return changed ? next : prev
      })
    }
    const id = setInterval(tick, 2000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (currentChannel !== null) {
      localStorage.setItem(CHANNEL_KEY, String(currentChannel));
    }
    setTyping(new Map())
  }, [currentChannel]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const c = clientRef.current
      if (!c) return
      c.refreshChannels().catch(() => {})
      const id = c.getCurrentChannel()
      if (id !== null) {
        c.reloadCurrentChannelHistory().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('pageshow', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('pageshow', onVisible)
    }
  }, [])

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const logout = params.get("logout") === "1";

    if (token) {
      window.history.replaceState({}, "", "/irc");
    }

    if (logout) {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(CHANNEL_KEY);
      localStorage.removeItem("late_redirect");
      window.history.replaceState({}, "", "/irc");
      window.location.reload();
      return;
    }

    const saved = localStorage.getItem(SESSION_KEY);
    let parsed: SSOSession | null = null;
    if (saved) {
      try {
        parsed = JSON.parse(saved) as SSOSession;
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }

    const startChat = async (s: SSOSession) => {
      if (cancelled) return
      const client = new ChatClient(s.session_id)
      clientRef.current = client
      client.onState((state) => {
        if (clientRef.current !== client) return
        if (state.connected !== undefined) {
          setConnected(state.connected)
          if (state.connected) clearSsoBudget()
        }
        if (state.tokenInvalid) setTokenInvalid(true)
        if (client.nickByUserId.size > 0) {
          setNickMap(new Map(client.nickByUserId))
        }
        if (state.user !== undefined) {
          setNick(state.user?.display_name || "")
          setMyUserId(state.user?.id ?? null)
          setGoogleName(state.user?.name || null)
          if (
            state.user?.display_name &&
            state.user.display_name === state.user.email.split("@")[0] &&
            !localStorage.getItem("chat.nick_prompted")
          ) {
            setShowNickModal(true)
            localStorage.setItem("chat.nick_prompted", "1")
          }
        }
        if (state.channels !== undefined) setChannels(new Map(state.channels))
        if (state.currentChannel !== undefined) setCurrentChannel(state.currentChannel)
      })
      client.onMessage((msg: ChatMessage) => {
        if (clientRef.current !== client) return
        if (msg.user_id === myUserIdRef.current) return
        setTyping(prev => {
          if (!prev.has(msg.user_id)) return prev
          const next = new Map(prev)
          next.delete(msg.user_id)
          return next
        })
        const prefs = notifPrefsRef.current
        const toast = formatToast(msg, myUserIdRef.current, nickRef.current)
        if (prefs.mode === 'all') {
          pushToast(`${msg.display_name}: ${msg.content.slice(0, 80)}`, 'join')
        } else if (prefs.mode === 'mentions' && toast?.type === 'mention') {
          pushToast(toast.text, toast.type)
          if (prefs.sound) playMentionBeep()
        } else if (prefs.mode === 'mentions' && toast) {
          pushToast(toast.text, toast.type)
        }
        if (toast?.type === 'mention' && document.hidden && prefs.system) {
          showSystemNotification(
            `${msg.display_name} te mencionó en #${(channelsRef.current.get(msg.channel_id)?.name || '').replace(/^#/, '')}`,
            msg.content,
          )
        }
      })
      client.onTyping((data) => {
        if (clientRef.current !== client) return
        if (data.channel_id !== currentChannel) return
        if (data.user_id === myUserIdRef.current) return
        setTyping(prev => {
          const next = new Map(prev)
          if (data.typing) {
            next.set(data.user_id, Date.now())
          } else {
            next.delete(data.user_id)
          }
          return next
        })
      })
      client.onBuzz((data) => {
        if (clientRef.current !== client) return
        playBuzz(notifPrefsRef.current.volume)
        setBuzzShake(true)
        setTimeout(() => setBuzzShake(false), 600)
        if (notifPrefsRef.current.vibration && navigator.vibrate) {
          navigator.vibrate([200, 100, 200, 100, 200])
        }
        pushToast(`🔔 ${data.from_display_name} te está zumbando`, 'mention')
      })
      client.onMemberMuted((data) => {
        if (clientRef.current !== client) return
        if (data.user_id === myUserIdRef.current) {
          const ch = channelsRef.current.get(data.channel_id)
          const label = data.muted ? 'silenciado' : 'desilenciado'
          pushToast(`Te han ${label} en ${ch?.name || '#canal'}`, 'mention')
        }
      })
      client.onAuthFatal(() => {
        if (cancelled) return
        if (ssoBudgetExhausted()) {
          setChatError("No se pudo conectar al chat. Reintentá en unos minutos.")
          setLoading(false)
          return
        }
        redirectToSso()
      })
      try {
        await client.start()
        client.listCategories().then(cats => setCategories(cats)).catch(() => {})
        const unsubVoice = client.onVoiceMessage((type, data) => {
          emitVoiceMessage(type, data)
        })
        voiceCleanupRef.current = unsubVoice
        setLoading(false)
        const savedCh = localStorage.getItem(CHANNEL_KEY)
        const targetId = savedCh ? Number(savedCh) : null
        const ch = targetId !== null ? client.channels.get(targetId) : null
        const finalId = ch ? targetId : (Array.from(client.channels.values())[0]?.id ?? null)
        if (finalId !== null) {
          await client.setCurrentChannel(finalId)
          await client.loadMembers(finalId)
        }
      } catch (err: any) {
        if (cancelled) return
        setLoading(false)
        if (tokenInvalidRef.current) return
        if (ssoBudgetExhausted()) {
          setChatError("No se pudo conectar al chat. Reintentá en unos minutos.")
          return
        }
        redirectToSso()
      }
    }

    if (!token && parsed) {
      startChat(parsed).catch(() => {})
      return
    }

    if (!token) {
      setLoading(false)
      if (ssoBudgetExhausted()) {
        setChatError("No se pudo conectar al chat. Reintentá en unos minutos.")
        return
      }
      redirectToSso()
      return
    }

    fetch("/api/chat/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.detail || "Error al conectar con el servidor")
        }
        return res.json() as Promise<SSOSession>
      })
      .then((s) => {
        if (cancelled) return
        localStorage.setItem(SESSION_KEY, JSON.stringify(s))
        startChat(s).catch(() => {})
      })
      .catch(() => {
        if (cancelled) return
        if (parsed) {
          startChat(parsed).catch(() => {})
        } else {
          setLoading(false)
          if (ssoBudgetExhausted()) {
            setChatError("No se pudo conectar al chat. Reintentá en unos minutos.")
            return
          }
          redirectToSso()
        }
      })

    const unsubKicked = onVoiceMessage((type, _data) => {
      if (type === 'kicked') {
        setActiveVoiceChannelId(null)
      }
    })

    return () => {
      cancelled = true
      unsubKicked()
      if (voiceCleanupRef.current) {
        voiceCleanupRef.current()
        voiceCleanupRef.current = null
      }
      for (const timer of toastTimers.current.values()) {
        clearTimeout(timer)
      }
      toastTimers.current.clear()
      if (clientRef.current) {
        clientRef.current.disconnect()
        clientRef.current = null
      }
    }
  }, [])

  const pushToast = useCallback((text: string, type: string) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev.slice(-4), { id, text, type }])
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      toastTimers.current.delete(id)
    }, 6500)
    toastTimers.current.set(id, timer)
  }, [])

  const handleNickCancel = useCallback(() => {
    setShowJoinModal(false)
  }, [])

  const handleNickChange = useCallback(async (newNick: string) => {
    try {
      const me = await clientRef.current?.updateMe({ display_name: newNick })
      if (me) {
        setNick(me.display_name)
        setMyUserId(me.id)
        setNickMap(prev => {
          const next = new Map(prev)
          next.set(me.id, me.display_name)
          return next
        })
        pushToast(`Tu nick ahora es ${me.display_name}`, 'join')
      }
    } catch (e) {
      pushToast(`No se pudo cambiar el nick: ${(e as Error).message}`, 'error')
    }
    localStorage.setItem("chat.nick_prompted", "1")
    setShowNickModal(false)
  }, [pushToast])

  const handleLoadMore = useCallback(async () => {
    if (currentChannel === null) return
    const ch = clientRef.current?.channels.get(currentChannel)
    if (!ch || ch.messages.length === 0) return
    setLoadingMore(true)
    try {
      const oldestId = ch.messages[0].id
      const loaded = await clientRef.current!.loadHistory(currentChannel, oldestId)
      if (loaded.length < 50) {
        setHasMore(prev => ({ ...prev, [currentChannel]: false }))
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false)
    }
  }, [currentChannel])

  const handleSend = useCallback((text: string) => {
    if (currentChannel === null) return
    const isAction = text.startsWith('/me ')
    const payload = isAction ? text.slice(4).trim() : text
    const opts: { is_action?: boolean; reply_to?: number } = { is_action: isAction }
    if (replyContext) opts.reply_to = replyContext.id
    clientRef.current?.sendMessage(currentChannel, payload, opts).catch((err) => {
      console.error("sendMessage failed", err)
    })
    setReplyContext(null)
  }, [currentChannel, replyContext])

  const handleReply = useCallback((msg: ChatMessage) => {
    setReplyContext(msg)
    messageInputRef.current?.focus()
  }, [])

  const handleForward = useCallback((msg: ChatMessage) => {
    setForwardContext(msg)
  }, [])

  const handleForwardSubmit = useCallback(async (messageId: number, targetChannelId: number) => {
    try {
      await clientRef.current?.forwardMessage(messageId, targetChannelId)
      pushToast('Mensaje reenviado', 'join')
    } catch (err) {
      pushToast(`Error al reenviar: ${(err as Error).message}`, 'error')
      throw err
    }
  }, [pushToast])

  const handleVideoRef = useCallback((attachmentId: string, el: HTMLVideoElement | null) => {
    if (el) {
      videoElementsRef.current.set(attachmentId, el)
      if (restoreTimeRef.current && restoreTimeRef.current.attachmentId === attachmentId) {
        el.currentTime = restoreTimeRef.current.time
        restoreTimeRef.current = null
      }
    }
  }, [])

  const handleVideoPlay = useCallback((attachmentId: string) => {
    playingVideoRef.current = attachmentId
  }, [])

  const handleVideoFloat = useCallback((attachmentId: string) => {
    const video = videoElementsRef.current.get(attachmentId)
    if (video && floatingContainerRef.current) {
      floatingContainerRef.current.appendChild(video)
    }
    floatingSourceChannelRef.current = currentChannel
    setFloatingVideo(attachmentId)
  }, [currentChannel])

  const handleBuzz = useCallback(async (targetUserId: number) => {
    if (currentChannel === null) return
    try {
      await clientRef.current?.buzz(currentChannel, targetUserId)
      const targetName = channelsRef.current.get(currentChannel)?.members?.find(m => m.id === targetUserId)?.display_name ?? 'usuario'
      playBuzz(notifPrefsRef.current.volume)
      setBuzzShake(true)
      setTimeout(() => setBuzzShake(false), 600)
      if (notifPrefsRef.current.vibration && navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200])
      }
      pushToast(`🔔 Zumbaste a ${targetName}`, 'mention')
    } catch (err) {
      pushToast(`Error: ${(err as Error).message}`, 'error')
    }
  }, [currentChannel, pushToast])

  const handleCopyText = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
  }, [])

  const handleSaveNotifPrefs = useCallback((prefs: any) => {
    setNotifPrefs(prefs)
    localStorage.setItem('chat.notif_prefs', JSON.stringify(prefs))
    setVolume(prefs.volume)
  }, [])

  const handleChannelSelect = useCallback((id: number) => {
    if (floatingVideoRef.current && id === floatingSourceChannelRef.current) {
      closeFloatingVideo()
    }
    const playing = playingVideoRef.current
    if (playing && !floatingVideoRef.current) {
      const video = videoElementsRef.current.get(playing)
      if (video && floatingContainerRef.current) {
        floatingContainerRef.current.appendChild(video)
      }
      floatingSourceChannelRef.current = currentChannel
      setFloatingVideo(playing)
    }
    clientRef.current?.setCurrentChannel(id).then(() => {
      clientRef.current?.loadMembers(id)
    }).catch(() => {})
    setCurrentChannel(id)
    setShowChannelsDrawer(false)
    setHasMore(prev => prev[id] !== false ? { ...prev, [id]: true } : prev)
  }, [])

  const handleChannelJoin = useCallback((name: string) => {
    const cleanName = name.replace(/^#/, "")
    clientRef.current?.joinChannel(cleanName).then((c) => {
      setCurrentChannel(c.id)
    }).catch((err) => {
      console.error("joinChannel failed", err)
    })
    setShowChannelsDrawer(false)
    setShowJoinModal(false)
  }, [])

  const handleVoiceJoin = useCallback((channelId: number) => {
    setActiveVoiceChannelId(channelId)
  }, [])

  const handleVoiceLeave = useCallback((_channelId: number) => {
    setActiveVoiceChannelId(null)
  }, [])

  const handleChannelLeave = useCallback(async (channelId: number) => {
    try {
      await clientRef.current?.api('POST', `/api/chat/channels/${channelId}/leave`)
      pushToast('Saliste del canal', 'join')
      const ch = channels.get(channelId)
      if (ch && ch.name === currentChan?.name) {
        const first = Array.from(channels.values()).find(c => c.joined && c.id !== channelId)
        if (first) {
          const prev = channels.get(channelId)
          if (prev) {
            const updated = { ...prev, joined: false }
            const next = new Map(channels)
            next.set(channelId, updated)
            setChannels(next)
          }
          handleChannelSelect(first.id)
        } else {
          setCurrentChannel(null)
        }
      }
    } catch (err) {
      pushToast(`Error al salir: ${(err as Error).message}`, 'error')
    }
  }, [channels, currentChannel])

  const handleJoinSubmit = useCallback((name: string) => {
    if (!name) return
    clientRef.current?.joinChannel(name).then((c) => {
      setCurrentChannel(c.id)
    }).catch((err) => {
      console.error("joinChannel failed", err)
    })
    setShowJoinModal(false)
  }, [])

  const currentChan = currentChannel !== null ? channels.get(currentChannel) : null

  const typingNames = useMemo(() => {
    if (typing.size === 0) return []
    const out: string[] = []
    for (const id of typing.keys()) {
      const nick = nickMap.get(id) ?? channelsRef.current.get(currentChannel ?? -1)?.members?.find(m => m.id === id)?.display_name
      if (nick) out.push(nick)
    }
    return out
  }, [typing, nickMap, currentChannel])
  const userCount = currentChan?.activeCount ?? currentChan?.memberCount ?? 0

  if (chatError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center px-4">
          <div className="text-slate-200 text-sm font-medium">{chatError}</div>
          <button
            onClick={() => {
              clearSsoBudget()
              setChatError(null)
              setLoading(true)
              window.location.reload()
            }}
            className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (loading || tokenInvalid) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          {tokenInvalid ? (
            <>
              <div className="text-slate-200 text-sm font-medium">Tu sesión expiró</div>
              <div className="text-slate-500 text-xs">Redirigiendo para重新登录…</div>
            </>
          ) : (
            <>
              <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-slate-400 text-sm">Conectando al chat...</div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`bg-slate-950 flex flex-col overflow-hidden ${audio.current ? 'pb-14' : 'pb-0'} ${buzzShake ? 'shake-buzz' : ''}`}
      style={{ height: `calc(${vh}px * 100 - ${headerHeight}px)` }}
    >
      {showJoinModal && (
        <JoinChannelModal
          onSubmit={handleJoinSubmit}
          onCancel={handleNickCancel}
        />
      )}

      {showNickModal && (
        <NickPromptModal
          suggestedNick={googleName || nick}
          onSubmit={handleNickChange}
          onCancel={() => setShowNickModal(false)}
        />
      )}

      {showSettingsModal && (
        <NotificationSettingsModal
          prefs={notifPrefs}
          onSave={handleSaveNotifPrefs}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {managingChannelId !== null && channels.get(managingChannelId) && (
        <ManageMembersModal
          channel={channels.get(managingChannelId)!}
          currentUserId={myUserId ?? 0}
          myRole={channels.get(managingChannelId)!.myRole}
          onClose={() => setManagingChannelId(null)}
          onApiCall={async (method, path, body) => {
            return clientRef.current!.api(method, path, body)
          }}
          onMemberChanged={() => {
            if (currentChannel !== null) {
              clientRef.current?.loadMembers(currentChannel)
            }
          }}
        />
      )}

      {forwardContext && (
        <ForwardModal
          message={forwardContext}
          channels={channels}
          currentChannelId={currentChannel}
          onClose={() => setForwardContext(null)}
          onForward={handleForwardSubmit}
        />
      )}

      <Topbar
        currentChan={currentChan ?? undefined}
        userCount={userCount}
        nick={nick}
        connected={connected}
        showUsersDrawer={showUsersDrawer}
        onToggleUsers={() => setShowUsersDrawer((v) => !v)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenChannels={() => setShowChannelsDrawer(true)}
        onChangeNick={() => setShowNickModal(true)}
      />

      <div className="flex flex-1 overflow-hidden relative">
        <aside className="w-48 flex-shrink-0 border-r border-slate-800 hidden sm:block select-none">
          <ChannelList
            channels={channels}
            categories={categories}
            currentChannel={currentChan?.name || "#lobby"}
            activeVoiceChannelId={activeVoiceChannelId}
            onSelect={(name) => {
              const ch = Array.from(channels.values()).find(c => c.name === name)
              if (ch) handleChannelSelect(ch.id)
            }}
            onJoin={(name) => {
              const ch = Array.from(channels.values()).find(c => c.name === name)
              if (ch) handleChannelSelect(ch.id)
              else handleChannelJoin(name)
            }}
            onVoiceJoin={handleVoiceJoin}
            onVoiceLeave={handleVoiceLeave}
            onCreateRequest={() => setShowJoinModal(true)}
            onLeave={handleChannelLeave}
            onCopyName={handleCopyText}
            onManageMembers={setManagingChannelId}
          />
        </aside>

        <main
          className="flex-1 flex flex-col min-w-0 relative"
          style={{
            backgroundColor: '#0b1120',
            backgroundImage: [
              'radial-gradient(at 20% 10%, rgba(99,102,241,0.10) 0px, transparent 50%)',
              'radial-gradient(at 80% 0%, rgba(168,85,247,0.08) 0px, transparent 50%)',
              'radial-gradient(at 90% 90%, rgba(14,165,233,0.07) 0px, transparent 50%)',
              'radial-gradient(at 10% 100%, rgba(236,72,153,0.06) 0px, transparent 50%)',
              "url(/bg.svg)",
            ].join(', '),
            backgroundAttachment: 'fixed, fixed, fixed, fixed, fixed',
            backgroundSize: 'auto, auto, auto, auto, 180px 180px',
          }}
        >
          {activeVoiceChannelId !== null ? (() => {
            const vch = channels.get(activeVoiceChannelId)
            if (!vch) return null
            return (
              <VoiceRoomView
                channel={vch}
                myUserId={myUserId}
                myRole={vch.myRole}
                nick={nick}
                nickMap={nickMap}
                sendViaWs={(msg) => clientRef.current?.sendRaw(msg)}
                onVoiceMessage={onVoiceMessage}
                onLeave={() => setActiveVoiceChannelId(null)}
                onSendMessage={(chId, content) => clientRef.current?.sendMessage(chId, content).catch(() => {})}
              />
            )
          })() : (
            <>
              <MessageList
                key={currentChannel ?? "none"}
                messages={currentChan?.messages || []}
                currentNick={nick}
                channelName={currentChan?.name || "#lobby"}
                channelMembers={currentChan?.members || []}
                nickByUserId={nickMap}
                myUserId={myUserId}
                myRole={currentChan?.myRole ?? null}
                onToggleReaction={(messageId, emoji) => {
                  clientRef.current?.toggleReaction(messageId, emoji).catch(() => {})
                }}
                onLoadMore={handleLoadMore}
                loadingMore={loadingMore}
                hasMore={currentChannel !== null ? hasMore[currentChannel] !== false : false}
                onReply={handleReply}
                onForward={handleForward}
                onBuzz={handleBuzz}
                onCopyText={handleCopyText}
                onHide={async (messageId) => {
                  try {
                    await clientRef.current?.api('POST', `/api/chat/messages/${messageId}/hide`)
                    pushToast('Mensaje oculto', 'join')
                  } catch (err) {
                    pushToast(`Error al ocultar: ${(err as Error).message}`, 'error')
                  }
                }}
                onDelete={async (messageId) => {
                  try {
                    await clientRef.current?.api('DELETE', `/api/chat/messages/${messageId}`)
                    pushToast('Mensaje eliminado', 'join')
                  } catch (err) {
                    pushToast(`Error al eliminar: ${(err as Error).message}`, 'error')
                  }
                }}
                onVideoFloat={handleVideoFloat}
                onVideoPlay={handleVideoPlay}
                onVideoRef={handleVideoRef}
                floatingVideo={floatingVideo}
              />
              <TypingIndicator names={typingNames} />
              <MessageInput
                ref={messageInputRef}
                onSend={handleSend}
                onTyping={currentChannel !== null ? () => clientRef.current?.sendTyping(currentChannel, true) : undefined}
                disabled={!connected || currentChannel === null}
                placeholder={connected ? `Mensaje en ${currentChan?.name || ''}` : "Conectando..."}
                channelMembers={currentChan?.members || []}
                channelId={currentChannel}
                replyContext={replyContext}
                onClearReply={() => setReplyContext(null)}
                onError={(msg) => pushToast(msg, 'error')}
                onUploadFile={async (chId, file) => {
                  return clientRef.current!.uploadAttachment(chId, file)
                }}
                onSendAttachment={async (chId, kind, attachmentId) => {
                  const marker = `__late_${kind}__:${attachmentId}`
                  clientRef.current?.sendMessage(chId, marker).catch((err) => {
                    console.error('sendAttachment failed', err)
                  })
                }}
                onSearchUsers={async (q) => {
                  try {
                    return await clientRef.current!.api('GET', `/api/chat/users?q=${encodeURIComponent(q)}`)
                  } catch {
                    return []
                  }
                }}
                onInviteUser={async (channelId, email) => {
                  try {
                    return await clientRef.current!.api('POST', `/api/chat/channels/${channelId}/invite`, { email })
                  } catch {
                    return { ok: false }
                  }
                }}
                onInviteConfirm={(user) => {
                  if (currentChannel !== null) {
                    clientRef.current?.loadMembers(currentChannel)
                  }
                  pushToast(`${user.display_name} se unió al canal`, 'join')
                }}
              />
            </>
          )}
          {toasts.length > 0 && (
            <div className="absolute top-2 right-3 z-50 flex flex-col items-end gap-2 max-w-md pointer-events-auto">
              {toasts.map(t => (
                <div
                  key={t.id}
                  onClick={() => {
                    setToasts(prev => prev.filter(x => x.id !== t.id))
                    const timer = toastTimers.current.get(t.id)
                    if (timer) { clearTimeout(timer); toastTimers.current.delete(t.id) }
                  }}
                  className={`flex items-start gap-3 px-5 py-3 rounded-xl text-sm font-medium shadow-floating border backdrop-blur-sm cursor-pointer transition-all hover:scale-[1.02] hover:-translate-x-0.5 animate-slide-in-from-top ${
                    t.type === 'mention'
                      ? 'bg-indigo-900/95 border-indigo-500/40 text-indigo-200 hover:border-indigo-400/70'
                      : t.type === 'join'
                      ? 'bg-emerald-900/95 border-emerald-500/30 text-emerald-200 hover:border-emerald-400/70'
                      : 'bg-rose-900/95 border-rose-500/30 text-rose-200 hover:border-rose-400/70'
                  }`}
                >
                  <span className="flex-1 break-words leading-snug">{t.text}</span>
                  <button
                    type="button"
                    className="text-slate-500 hover:text-slate-200 flex-shrink-0 -mr-1"
                    aria-label="Cerrar"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>

        {showUsersDrawer && currentChannel !== null && (
          <aside className="hidden sm:flex w-64 flex-shrink-0 border-l border-slate-800 flex-col bg-slate-900 select-none">
            {showUsersDrawer && (
              <>
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Usuarios en línea
                  </h3>
                  <span className="text-[10px] text-slate-500 tabular-nums">
                    {currentChan?.members?.filter(m => m.active).length ?? 0}/{currentChan?.members?.length ?? 0}
                  </span>
                  <button
                    onClick={() => setShowUsersDrawer(false)}
                    className="text-slate-500 hover:text-slate-300 transition-colors p-1 -mr-1"
                    aria-label="Cerrar"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <UserList
                  users={currentChan?.members || []}
                  onBuzz={handleBuzz}
                  onCopyName={handleCopyText}
                />
              </>
            )}
          </aside>
        )}
      </div>

      <Drawer
        open={showChannelsDrawer}
        onClose={() => setShowChannelsDrawer(false)}
        side="left"
      >
          <ChannelList
            channels={channels}
            categories={categories}
            currentChannel={currentChan?.name || "#lobby"}
            activeVoiceChannelId={activeVoiceChannelId}
            onSelect={(name) => {
              const ch = Array.from(channels.values()).find(c => c.name === name)
              if (ch) handleChannelSelect(ch.id)
            }}
            onJoin={(name) => {
              const ch = Array.from(channels.values()).find(c => c.name === name)
              if (ch) handleChannelSelect(ch.id)
              else handleChannelJoin(name)
            }}
            onVoiceJoin={handleVoiceJoin}
            onVoiceLeave={handleVoiceLeave}
            onCreateRequest={() => { setShowChannelsDrawer(false); setShowJoinModal(true) }}
            onClose={() => setShowChannelsDrawer(false)}
            onLeave={handleChannelLeave}
            onCopyName={handleCopyText}
            onManageMembers={setManagingChannelId}
          />
      </Drawer>
      <Drawer
        open={showUsersDrawer}
        onClose={() => setShowUsersDrawer(false)}
        side="right"
      >
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Usuarios en línea
          </h3>
          <span className="text-[10px] text-slate-500 tabular-nums">
            {currentChan?.members?.filter(m => m.active).length ?? 0}/{currentChan?.members?.length ?? 0}
          </span>
        </div>
        <UserList
          users={currentChan?.members || []}
          onBuzz={handleBuzz}
          onCopyName={handleCopyText}
        />
      </Drawer>
      <MiniPlayer />
      <FloatingVideoContainer
        ref={floatingContainerRef}
        visible={floatingVideo}
        onClose={closeFloatingVideo}
      />
    </div>
  )
}
