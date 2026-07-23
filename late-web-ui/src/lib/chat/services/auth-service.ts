import { debugLog, debugError } from '@/lib/session-debug'

const SESSION_KEY = 'chat.session'
const SSO_URL = 'https://www.kodingvibes.com/api/sso/irc-token'
const SSO_REDIRECT_COUNT_KEY = 'chat.sso_redirects'
const MAX_SSO_REDIRECTS = 2

export function redirectToSso() {
  const next = Number(sessionStorage.getItem(SSO_REDIRECT_COUNT_KEY) || '0') + 1
  sessionStorage.setItem(SSO_REDIRECT_COUNT_KEY, String(next))
  // Always clear the session before redirecting so the SSO
  // exchange gets a fresh token. Without this, a stale token
  // would just bounce us back here and exhaust the budget.
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem('chat.channel')
  localStorage.removeItem('late_redirect')
  debugLog('sso', 'redirectToSso()', { redirectCount: next, budget: MAX_SSO_REDIRECTS, clearing: 'chat.session, chat.channel, late_redirect' })
  window.location.href = SSO_URL
}

export function ssoBudgetExhausted(): boolean {
  const count = Number(sessionStorage.getItem(SSO_REDIRECT_COUNT_KEY) || '0')
  return count >= MAX_SSO_REDIRECTS
}

export function clearSsoBudget() {
  const prev = sessionStorage.getItem(SSO_REDIRECT_COUNT_KEY)
  sessionStorage.removeItem(SSO_REDIRECT_COUNT_KEY)
  debugLog('sso', 'clearSsoBudget()', { prev })
}

/**
 * Full sign-out: clears the session, the SSO redirect budget,
 * and the saved channel. Forces the next reload to go through
 * SSO from scratch. Use this when the user explicitly wants to
 * "log out and try again" — e.g. when a stale token is locking
 * them out of the chat.
 */
export function fullSignOut() {
  const had = localStorage.getItem(SESSION_KEY) !== null
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem('chat.channel')
  localStorage.removeItem('late_redirect')
  sessionStorage.removeItem(SSO_REDIRECT_COUNT_KEY)
  debugLog('sso', 'fullSignOut()', { hadSavedSession: had, action: 'redirect-to-sso' })
  window.location.href = SSO_URL
}

export function getSavedSession<T>(): T | null {
  const saved = localStorage.getItem(SESSION_KEY)
  if (!saved) {
    debugLog('session', 'getSavedSession() -> null (no key in localStorage)')
    return null
  }
  try {
    const parsed = JSON.parse(saved) as T
    debugLog('session', 'getSavedSession() -> ok', {
      session_id_len: (parsed as any)?.session_id ? (parsed as any).session_id.length : 0,
      expires_at: (parsed as any)?.expires_at ?? null,
      user_id: (parsed as any)?.user?.id ?? null,
      email: (parsed as any)?.user?.email ?? null,
    })
    return parsed
  } catch (e) {
    debugError('session', 'getSavedSession() parse failed, removing', { error: String(e) })
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function saveSession<T>(session: T) {
  const s = session as any
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  debugLog('session', 'saveSession()', {
    session_id_len: s?.session_id ? String(s.session_id).length : 0,
    expires_at: s?.expires_at ?? null,
    user_id: s?.user?.id ?? null,
    email: s?.user?.email ?? null,
  })
}

export function clearSession() {
  const had = localStorage.getItem(SESSION_KEY) !== null
  localStorage.removeItem(SESSION_KEY)
  debugLog('session', 'clearSession()', { hadSavedSession: had })
}
