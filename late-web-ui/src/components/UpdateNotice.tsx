import { useEffect, useState } from 'react'
import { APP_VERSION } from '@/lib/version'

type Status = 'idle' | 'outdated' | 'current'

export function UpdateNotice() {
  const [status, setStatus] = useState<Status>('idle')

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch('/version.json', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { version?: string }
        if (cancelled || !data.version) return
        setStatus(data.version === APP_VERSION ? 'current' : 'outdated')
      } catch {
        // ponytail: network blips are fine, retry on next tick
      }
    }
    check()
    const t = setInterval(check, 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (status !== 'outdated') return null

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 sm:gap-3 bg-indigo-600 text-white text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 sm:py-2.5 rounded-full shadow-lg shadow-indigo-900/40 max-w-[calc(100vw-1.5rem)]">
      <span className="hidden sm:inline">Nueva versión disponible</span>
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
