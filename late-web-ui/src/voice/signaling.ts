export type VoiceMessageHandler = (data: any) => void

export interface VoiceSignaling {
  join: (roomId?: string) => void
  leave: (roomId?: string) => void
  sendOffer: (to: number, sdp: string) => void
  sendAnswer: (to: number, sdp: string) => void
  sendIce: (to: number, candidate: string) => void
  sendHangup: () => void
  on: (type: string, handler: VoiceMessageHandler) => () => void
  destroy: () => void
}

export function createVoiceSignaling(sendViaWs: (msg: object) => void): VoiceSignaling {
  const handlers = new Map<string, Set<VoiceMessageHandler>>()

  const on = (type: string, handler: VoiceMessageHandler): (() => void) => {
    if (!handlers.has(type)) handlers.set(type, new Set())
    handlers.get(type)!.add(handler)
    return () => handlers.get(type)?.delete(handler)
  }

  return {
    join(roomId = 'lobby') {
      sendViaWs({ type: 'voice.join', roomId })
    },
    leave(roomId = 'lobby') {
      sendViaWs({ type: 'voice.leave', roomId })
    },
    sendOffer(to: number, sdp: string) {
      sendViaWs({ type: 'voice.offer', to, sdp })
    },
    sendAnswer(to: number, sdp: string) {
      sendViaWs({ type: 'voice.answer', to, sdp })
    },
    sendIce(to: number, candidate: string) {
      sendViaWs({ type: 'voice.ice', to, candidate })
    },
    sendHangup() {
      sendViaWs({ type: 'voice.hangup' })
    },
    on,
    destroy() {
      handlers.clear()
    },
  }
}

