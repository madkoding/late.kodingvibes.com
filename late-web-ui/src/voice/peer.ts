const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
]

export interface VoicePeerCallbacks {
  onIceCandidate: (candidate: string) => void
  onStream: (stream: MediaStream) => void
  onConnectionState: (state: string) => void
}

export class VoicePeer {
  private pc: RTCPeerConnection
  private callbacks: VoicePeerCallbacks
  private pendingIce: string[] = []

  constructor(
    private peerId: number,
    _isInitiator: boolean,
    callbacks: VoicePeerCallbacks,
    localStream?: MediaStream,
  ) {
    this.callbacks = callbacks
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.callbacks.onIceCandidate(JSON.stringify(e.candidate))
      }
    }

    this.pc.ontrack = (e) => {
      this.callbacks.onStream(e.streams[0])
    }

    this.pc.onconnectionstatechange = () => {
      this.callbacks.onConnectionState(this.pc.connectionState)
    }

    if (localStream) {
      localStream.getTracks().forEach(t => this.pc.addTrack(t, localStream))
    }
  }

  async createOffer(): Promise<string> {
    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    return JSON.stringify(offer)
  }

  async createAnswer(): Promise<string> {
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    return JSON.stringify(answer)
  }

  async handleOffer(sdp: string) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp)))
    // Flush pending ICE candidates
    for (const c of this.pendingIce) {
      await this.pc.addIceCandidate(JSON.parse(c))
    }
    this.pendingIce = []
  }

  async handleAnswer(sdp: string) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdp)))
    for (const c of this.pendingIce) {
      await this.pc.addIceCandidate(JSON.parse(c))
    }
    this.pendingIce = []
  }

  async handleIce(candidate: string) {
    if (this.pc.remoteDescription) {
      await this.pc.addIceCandidate(JSON.parse(candidate))
    } else {
      this.pendingIce.push(candidate)
    }
  }

  get id() { return this.peerId }
  get connectionState() { return this.pc.connectionState }

  close() {
    this.pc.close()
  }

  /** Add the given stream's tracks to the connection and re-negotiate.
   *  Used when the local mic resolves AFTER the initial offer was sent
   *  (without an audio track). Returns the new offer SDP if we are the
   *  initiator, else the answer SDP. Returns null if neither side
   *  needs a re-negotiation. */
  async addLocalStream(stream: MediaStream): Promise<{ kind: 'offer' | 'answer'; sdp: string } | null> {
    const senders = this.pc.getSenders()
    for (const track of stream.getTracks()) {
      const hasSender = senders.some(s => s.track && s.track.kind === track.kind)
      if (!hasSender) {
        this.pc.addTrack(track, stream)
      }
    }
    // If we already have a remote description, re-negotiate.
    if (this.pc.remoteDescription) {
      const answer = await this.pc.createAnswer()
      await this.pc.setLocalDescription(answer)
      return { kind: 'answer', sdp: JSON.stringify(answer) }
    }
    if (this.pc.localDescription) {
      // We're the initiator, already sent an offer without audio.
      // Re-offer with audio now.
      const offer = await this.pc.createOffer({ iceRestart: false })
      await this.pc.setLocalDescription(offer)
      return { kind: 'offer', sdp: JSON.stringify(offer) }
    }
    return null
  }

  /** Restart ICE — useful when the connection has failed or
   *  disconnected and we want to try a fresh candidate gathering
   *  round. Returns the new offer SDP (we must be the initiator, or
   *  have an active remote description). */
  async restartIce(): Promise<string | null> {
    if (!this.pc.remoteDescription && !this.pc.localDescription) {
      // No negotiation yet — just create a fresh offer.
      const offer = await this.pc.createOffer({ iceRestart: true })
      await this.pc.setLocalDescription(offer)
      return JSON.stringify(offer)
    }
    if (this.pc.remoteDescription) {
      // We're the answerer. To restart ICE we need to ask the offerer
      // to re-offer. For now return null — the caller's UI will
      // surface a reconnect prompt. (We rarely hit this path because
      // the offerer drives the flow.)
      return null
    }
    // We're the offerer — re-offer with ICE restart.
    const offer = await this.pc.createOffer({ iceRestart: true })
    await this.pc.setLocalDescription(offer)
    return JSON.stringify(offer)
  }
}
