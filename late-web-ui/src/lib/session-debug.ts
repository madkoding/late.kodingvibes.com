// ponytail: ring buffer, last 200 entries, exposed via window.__lateDebug.snapshot()
// for users to copy and paste when they're locked out. Server-side token is masked.

export type DebugEntry = { t: number; tag: string; msg: string; data?: unknown }

const RING_SIZE = 200
const buffer: DebugEntry[] = []

function push(entry: DebugEntry) {
  buffer.push(entry)
  if (buffer.length > RING_SIZE) buffer.shift()
}

function fmt(data: unknown): string {
  if (data === undefined) return ''
  try {
    return ' ' + JSON.stringify(data, (_k, v) => {
      if (typeof v === 'string' && v.length > 200) return v.slice(0, 200) + '…'
      return v
    })
  } catch {
    return ' [unserializable]'
  }
}

export function debugLog(tag: string, msg: string, data?: unknown) {
  const entry: DebugEntry = { t: Date.now(), tag, msg, data }
  push(entry)
  const line = `[late-debug ${tag}] ${msg}${fmt(data)}`
  // console.debug so it doesn't show by default but is one click away in DevTools
  // eslint-disable-next-line no-console
  console.debug(line)
}

export function debugError(tag: string, msg: string, data?: unknown) {
  const entry: DebugEntry = { t: Date.now(), tag, msg, data }
  push(entry)
  const line = `[late-debug ${tag}] ${msg}${fmt(data)}`
  // eslint-disable-next-line no-console
  console.error(line)
}

function maskToken(s: string | null | undefined): string {
  if (!s) return '(none)'
  if (s.length <= 12) return '***' + s.slice(-4)
  return s.slice(0, 8) + '…' + s.slice(-6) + ' (len=' + s.length + ')'
}

type Snapshot = {
  capturedAt: string
  appVersion: string
  page: string
  url: string
  userAgent: string
  session: {
    hasSavedSession: boolean
    savedSessionIdMasked: string | null
    savedSessionExpiresAt: number | null
    savedSessionUserId: number | null
    savedSessionEmail: string | null
    savedSessionDisplayName: string | null
    savedSessionRaw: string | null
  } | null
  sso: {
    redirectCount: number
    budget: number
    budgetExhausted: boolean
    ssoUrl: string
  }
  urlToken: { present: boolean; masked: string; logoutFlag: boolean }
  log: DebugEntry[]
}

export function takeSnapshot(): Snapshot {
  let savedRaw: string | null = null
  let saved: any = null
  try {
    savedRaw = localStorage.getItem('chat.session')
    if (savedRaw) saved = JSON.parse(savedRaw)
  } catch {
    /* ignore */
  }

  const redirectCount = Number(sessionStorage.getItem('chat.sso_redirects') || '0')
  const budget = 2
  const params = new URLSearchParams(window.location.search)

  return {
    capturedAt: new Date().toISOString(),
    appVersion: (window as any).__APP_VERSION__ || 'unknown',
    page: window.location.pathname,
    url: window.location.href,
    userAgent: navigator.userAgent,
    session: saved
      ? {
          hasSavedSession: true,
          savedSessionIdMasked: maskToken(saved.session_id),
          savedSessionExpiresAt: saved.expires_at ?? null,
          savedSessionUserId: saved.user?.id ?? null,
          savedSessionEmail: saved.user?.email ?? null,
          savedSessionDisplayName: saved.user?.display_name ?? null,
          savedSessionRaw: savedRaw,
        }
      : null,
    sso: {
      redirectCount,
      budget,
      budgetExhausted: redirectCount >= budget,
      ssoUrl: 'https://www.kodingvibes.com/api/sso/irc-token',
    },
    urlToken: {
      present: params.has('token'),
      masked: maskToken(params.get('token')),
      logoutFlag: params.get('logout') === '1',
    },
    log: buffer.slice(),
  }
}

export function installDebugHandle() {
  ;(window as any).__lateDebug = {
    snapshot: takeSnapshot,
    log: debugLog,
    error: debugError,
    copy: async () => {
      const text = JSON.stringify(takeSnapshot(), null, 2)
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        return false
      }
    },
    raw: () => localStorage.getItem('chat.session'),
  }
}
