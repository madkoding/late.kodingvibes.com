import { useEffect, useRef } from 'react'
import { useAudio } from './AudioProvider'

/**
 * Polls Icecast's /status-json.xsl every 5s and pushes the
 * current mount's metadata (artist + track) into the audio
 * context. Lives inside the AudioProvider so the metadata
 * stays in sync regardless of which page is mounted — the
 * MiniPlayer shows the current song even when the user is on
 * /irc or /.
 */
export function TrackMetadataSync() {
  const audio = useAudio()
  const lastTrackKey = useRef<string | null>(null)

  useEffect(() => {
    if (!audio.current) return
    const mount = audio.current.mount
    let cancelled = false

    const fetchOnce = async () => {
      try {
        const res = await fetch('/status-json.xsl', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (cancelled) return
        const stats = json?.icestats?.source
        if (!stats) return
        const sources = Array.isArray(stats) ? stats : [stats]
        const src = sources.find((s: any) => s.listenurl?.endsWith('/' + mount))
        if (!src) return
        const raw = (src.title ?? '').trim() || null
        if (!raw) {
          // No metadata for this mount right now.
          if (lastTrackKey.current !== null) {
            audio.setTrack({ artist: null, title: null, raw: null })
            lastTrackKey.current = null
          }
          return
        }
        // Skip the broadcast if the raw string hasn't changed,
        // so we don't cause a context re-render every 5s for no
        // reason.
        if (lastTrackKey.current === raw) return
        lastTrackKey.current = raw
        // Icecast title format is usually "Artist - Track", but
        // it can be "Track" or "Artist — Track" (em-dash) or
        // just about anything. Split on the first " - " or " — ".
        let artist: string | null = null
        let title: string | null = raw
        const dashMatch = raw.match(/^(.+?)\s+[-\u2014\u2013]\s+(.+)$/)
        if (dashMatch) {
          artist = dashMatch[1].trim()
          title = dashMatch[2].trim()
        }
        audio.setTrack({ artist, title, raw })
      } catch { /* ignore */ }
    }

    fetchOnce()
    const t = setInterval(fetchOnce, 5000)
    return () => { cancelled = true; clearInterval(t) }
  }, [audio.current?.mount, audio])

  return null
}
