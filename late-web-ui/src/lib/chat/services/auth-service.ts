const SESSION_KEY = 'chat.session'
const SSO_URL = 'https://www.kodingvibes.com/api/sso/irc-token'
const SSO_REDIRECT_COUNT_KEY = 'chat.sso_redirects'
const MAX_SSO_REDIRECTS = 2

export function redirectToSso() {
  const next = Number(sessionStorage.getItem(SSO_REDIRECT_COUNT_KEY) || '0') + 1
  sessionStorage.setItem(SSO_REDIRECT_COUNT_KEY, String(next))
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem('chat.channel')
  localStorage.removeItem('late_redirect')
  window.location.href = SSO_URL
}

export function ssoBudgetExhausted(): boolean {
  return Number(sessionStorage.getItem(SSO_REDIRECT_COUNT_KEY) || '0') >= MAX_SSO_REDIRECTS
}

export function clearSsoBudget() {
  sessionStorage.removeItem(SSO_REDIRECT_COUNT_KEY)
}

export function getSavedSession<T>(): T | null {
  const saved = localStorage.getItem(SESSION_KEY)
  if (!saved) return null
  try { return JSON.parse(saved) as T } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function saveSession<T>(session: T) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}
