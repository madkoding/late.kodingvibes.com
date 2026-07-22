import { create } from 'zustand'

interface NotifPrefs {
  mode: 'mentions' | 'all' | 'none'
  volume: number
  sound: boolean
  vibration: boolean
  system: boolean
}

const STORAGE_KEY = 'chat.notif_prefs'

function loadPrefs(): NotifPrefs {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { mode: 'mentions', volume: 70, sound: true, vibration: true, system: true, ...JSON.parse(saved) }
  } catch { /* ignore */ }
  return { mode: 'mentions', volume: 70, sound: true, vibration: true, system: true }
}

function savePrefs(prefs: NotifPrefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)) } catch { /* ignore */ }
}

interface NotifPrefsState {
  prefs: NotifPrefs
  setPrefs: (patch: Partial<NotifPrefs>) => void
}

export const useNotifPrefsStore = create<NotifPrefsState>((set) => ({
  prefs: loadPrefs(),
  setPrefs: (patch) => set((s) => {
    const next = { ...s.prefs, ...patch }
    savePrefs(next)
    return { prefs: next }
  }),
}))
