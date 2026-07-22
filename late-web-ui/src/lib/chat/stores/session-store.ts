import { create } from 'zustand'
import type { UserInfo } from '../domain/types'

interface SessionState {
  user: UserInfo | null
  connected: boolean
  tokenInvalid: boolean
  setUser: (user: UserInfo | null) => void
  setConnected: (connected: boolean) => void
  setTokenInvalid: (invalid: boolean) => void
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  connected: false,
  tokenInvalid: false,
  setUser: (user) => set({ user }),
  setConnected: (connected) => set({ connected }),
  setTokenInvalid: (invalid) => set({ tokenInvalid: invalid }),
}))
