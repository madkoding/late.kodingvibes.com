import { describe, it, expect, beforeEach } from 'vitest'
import { useNotifPrefsStore } from './notif-prefs-store'

describe('notif-prefs-store', () => {
  beforeEach(() => {
    localStorage.clear()
    useNotifPrefsStore.setState({ prefs: { mode: 'mentions', volume: 70, sound: true, vibration: true, system: true } })
  })

  it('defaults are correct', () => {
    const { prefs } = useNotifPrefsStore.getState()
    expect(prefs.mode).toBe('mentions')
    expect(prefs.volume).toBe(70)
    expect(prefs.sound).toBe(true)
    expect(prefs.vibration).toBe(true)
    expect(prefs.system).toBe(true)
  })

  it('loadPrefs from localStorage', () => {
    localStorage.setItem('chat.notif_prefs', JSON.stringify({ mode: 'all', volume: 50, sound: false }))
    useNotifPrefsStore.setState({ prefs: { mode: 'mentions', volume: 70, sound: true, vibration: true, system: true } })
    const store = useNotifPrefsStore.getState()
    expect(store.prefs.mode).toBe('mentions')
    expect(store.prefs.volume).toBe(70)
  })

  it('setPrefs merges and saves', () => {
    useNotifPrefsStore.getState().setPrefs({ volume: 30, sound: false })
    const { prefs } = useNotifPrefsStore.getState()
    expect(prefs.volume).toBe(30)
    expect(prefs.sound).toBe(false)
    expect(prefs.mode).toBe('mentions')
    const saved = JSON.parse(localStorage.getItem('chat.notif_prefs')!)
    expect(saved.volume).toBe(30)
    expect(saved.sound).toBe(false)
  })
})
