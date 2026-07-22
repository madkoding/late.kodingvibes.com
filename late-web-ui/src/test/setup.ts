import '@testing-library/jest-dom/vitest'

if (typeof window !== 'undefined' && !window.AudioContext) {
  class MockAudioContext {
    currentTime = 0
    state = 'running'
    createOscillator() {
      return {
        type: 'sine',
        frequency: { value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
        connect: () => {},
        start: () => {},
        stop: () => {},
      }
    }
    createGain() {
      return {
        gain: { value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, setTargetAtTime: () => {} },
        connect: () => {},
      }
    }
    createAnalyser() {
      return {
        fftSize: 512,
        frequencyBinCount: 32,
        getByteFrequencyData: () => {},
        getByteTimeDomainData: () => {},
        connect: () => {},
      }
    }
    createMediaElementSource() {
      return { connect: () => {} }
    }
    createMediaStreamSource() {
      return { connect: () => {} }
    }
    createMediaStreamDestination() {
      return { stream: new MediaStream() }
    }
    createBiquadFilter() {
      return {
        type: 'highpass',
        frequency: { value: 0 },
        Q: { value: 0.7 },
        gain: { value: 0 },
        connect: () => {},
      }
    }
    createDynamicsCompressor() {
      return {
        threshold: { value: 0 },
        ratio: { value: 1 },
        attack: { value: 0 },
        release: { value: 0 },
        knee: { value: 0 },
        connect: () => {},
      }
    }
    createWaveShaper() {
      return { curve: null, connect: () => {} }
    }
    resume() { return Promise.resolve() }
    close() { return Promise.resolve() }
    destination = { connect: () => {} }
  }
  ;(window as any).AudioContext = MockAudioContext
  ;(window as any).webkitAudioContext = MockAudioContext
}

if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {} }) as any
}

if (typeof window !== 'undefined' && !window.visualViewport) {
  Object.defineProperty(window, 'visualViewport', {
    value: { height: 800, width: 1200, addEventListener: () => {}, removeEventListener: () => {}, scroll: () => {} },
    writable: true,
  })
}

if (typeof window !== 'undefined' && !('Notification' in window)) {
  Object.defineProperty(window, 'Notification', {
    value: { permission: 'default', requestPermission: () => Promise.resolve('granted') },
    writable: true,
  })
}

if (typeof window !== 'undefined' && !('createImageBitmap' in window)) {
  ;(window as any).createImageBitmap = async () => ({ width: 100, height: 100, close: () => {} })
}

if (typeof window !== 'undefined' && !('RTCPeerConnection' in window)) {
  class MockRTCPeerConnection {
    iceServers: RTCIceServer[] = []
    localDescription: any = null
    remoteDescription: any = null
    connectionState = 'new'
    onicecandidate: ((e: any) => void) | null = null
    ontrack: ((e: any) => void) | null = null
    onconnectionstatechange: (() => void) | null = null
    constructor(config?: RTCConfiguration) {
      this.iceServers = config?.iceServers ?? []
    }
    createOffer() { return Promise.resolve({ type: 'offer', sdp: '' }) }
    createAnswer() { return Promise.resolve({ type: 'answer', sdp: '' }) }
    setLocalDescription() { return Promise.resolve() }
    setRemoteDescription() { return Promise.resolve() }
    addIceCandidate() { return Promise.resolve() }
    addTrack() {}
    close() {}
  }
  ;(window as any).RTCPeerConnection = MockRTCPeerConnection
  ;(window as any).RTCSessionDescription = class { constructor(init: any) { return init } }
  ;(window as any).RTCIceCandidate = class { constructor(init: any) { return init } }
}

if (typeof window !== 'undefined' && !('MediaRecorder' in window)) {
  class MockMediaRecorder {
    state = 'inactive'
    mimeType = 'audio/webm'
    ondataavailable: ((e: any) => void) | null = null
    onstop: (() => void) | null = null
    onerror: (() => void) | null = null
    constructor(_stream: MediaStream, _options?: any) {}
    start() { this.state = 'recording' }
    stop() {
      this.state = 'inactive'
      this.onstop?.()
    }
    static isTypeSupported() { return true }
  }
  ;(window as any).MediaRecorder = MockMediaRecorder
}

if (typeof window !== 'undefined' && !('MediaStream' in window)) {
  class MockMediaStream {
    getTracks() { return [{ stop: () => {} }] }
    getAudioTracks() { return [] }
  }
  ;(window as any).MediaStream = MockMediaStream
}

if (typeof window !== 'undefined' && !('navigator.mediaDevices' in navigator)) {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: () => Promise.resolve(new MediaStream()) },
    writable: true,
  })
}
