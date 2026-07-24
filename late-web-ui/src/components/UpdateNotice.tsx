import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { APP_VERSION } from '@/lib/version'

type Source = 'shell' | 'radio' | 'chat'

interface OutdatedInfo {
  sources: Set<Source>
}

const POLL_MS = 30_000

function readSeen(): Record<Source, string> {
  try {
    const raw = localStorage.getItem('late.seen')
    if (raw) return JSON.parse(raw) as Record<Source, string>
  } catch { /* ignore */ }
  return { shell: APP_VERSION, radio: '', chat: '' }
}

function writeSeen(seen: Record<Source, string>) {
  try { localStorage.setItem('late.seen', JSON.stringify(seen)) } catch { /* ignore */ }
}

async function fetchManifest(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { version?: string }
    return data.version ?? null
  } catch {
    return null
  }
}

export function UpdateNotice() {
  const [info, setInfo] = useState<OutdatedInfo | null>(null)
  const loc = useLocation()

  useEffect(() => {
    let cancelled = false
    // Seed localStorage with whatever is currently running so the first
    // tick doesn't fire a toast for the version the user just loaded.
    const seen = readSeen()
    let primed = seen.radio !== '' && seen.chat !== ''
    if (!primed) {
      const seed: Record<Source, string> = {
        shell: APP_VERSION,
        radio: seen.radio || APP_VERSION,
        chat: seen.chat || APP_VERSION,
      }
      writeSeen(seed)
    }

    const tick = async () => {
      const [shellV, radioV, chatV] = await Promise.all([
        fetchManifest('/version.json'),
        fetchManifest('/micro/radio/latest.json'),
        fetchManifest('/micro/chat/latest.json'),
      ])
      if (cancelled) return
      const current = readSeen()
      const outdated = new Set<Source>()
      if (shellV && shellV !== APP_VERSION && shellV !== current.shell) outdated.add('shell')
      if (radioV && radioV !== current.radio && current.radio !== '') outdated.add('radio')
      if (chatV && chatV !== current.chat && current.chat !== '') outdated.add('chat')
      if (outdated.size > 0) {
        // Mark as seen so the next tick doesn't double-fire. The user
        // either reloads (which updates APP_VERSION on next mount) or
        // they don't, and we stop pestering them.
        writeSeen({
          shell: outdated.has('shell') ? shellV! : current.shell,
          radio: outdated.has('radio') ? radioV! : current.radio,
          chat:  outdated.has('chat')  ? chatV!  : current.chat,
        })
        setInfo({ sources: outdated })
      }
    }

    tick()
    const t = setInterval(tick, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!info || info.sources.size === 0) return null

  // Only show the toast for the source the user is actually looking at.
  // The shell update is global; the micro updates only matter on their
  // route. Showing a chat-upgrade toast while the user is on /icecast
  // is the kind of noise that gets the notice ignored forever.
  const visible: Source[] = []
  for (const s of info.sources) {
    if (s === 'shell') visible.push('shell')
    else if (s === 'radio' && loc.pathname === '/icecast') visible.push('radio')
    else if (s === 'chat' && loc.pathname === '/irc') visible.push('chat')
  }
  if (visible.length === 0) return null

  const label = visible.length === 1
    ? `Nueva versión de ${visible[0]} disponible`
    : 'Nueva versión disponible'

  return (
    <div
      role="status"
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 sm:gap-3 bg-indigo-600 text-white text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 sm:py-2.5 rounded-full shadow-lg shadow-indigo-900/40 max-w-[calc(100vw-1.5rem)]"
    >
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">Actualización</span>
      <button
        onClick={() => location.reload()}
        className="bg-white text-indigo-700 px-2.5 py-1 rounded-full font-bold hover:bg-indigo-50"
      >
        Actualizar
      </button>
    </div>
  )
}
