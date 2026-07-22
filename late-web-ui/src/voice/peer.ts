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
}
