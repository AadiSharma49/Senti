// Loaded independently in each same-origin iframe (separate renderer module state).
const role = new URL(location.href).searchParams.get('role')
const pcs = [], channels = [], keys = [], transitions = []
let handle, source, drawCount = 0, raf, sourceRate, latestPresent = 0
let observing = false, times = []
const note = state => transitions.push({ ms: Math.round(performance.now()), state })
window.addEventListener('error', e => parent.loopError(`${role}: ${e.message}`))
window.addEventListener('unhandledrejection', e => parent.loopError(`${role}: ${e.reason}`))
localStorage.setItem('senti:apiUrl', location.origin)
window.senti = Object.freeze({ api: parent.makeBridge(role) })
// Even if a future renderer adds capture to peer startup, never open a picker/device.
for (const method of ['getDisplayMedia', 'getUserMedia']) {
  Object.defineProperty(navigator.mediaDevices, method, { value: () => { throw Error('Real capture forbidden') } })
}
// Real implementation; remove public STUN/TURN and retain references ONLY for stats,
// passive event observations, and the one explicit transport-close test.
const NativePC = window.RTCPeerConnection
window.RTCPeerConnection = class extends NativePC {
  constructor(config) {
    super({ ...config, iceServers: [] })
    pcs.push(this)
    for (const [event, prop] of [['connectionstatechange', 'connectionState'], ['signalingstatechange', 'signalingState'], ['icegatheringstatechange', 'iceGatheringState'], ['iceconnectionstatechange', 'iceConnectionState']]) {
      this.addEventListener(event, () => note(`${prop}:${this[prop]}`))
    }
    this.addEventListener('icecandidate', ({ candidate }) => note(`gather:${candidate ? candidate.type + '/' + candidate.protocol : 'end'}`))
    this.addEventListener('datachannel', e => {
      const ch = e.channel
      const meta = { label: ch.label, ordered: ch.ordered, maxRetransmits: ch.maxRetransmits,
        maxPacketLifeTime: ch.maxPacketLifeTime, keyMessages: 0 }
      channels.push(meta)
      ch.addEventListener('message', ({ data }) => {
        const parsed = JSON.parse(data)
        if ([parsed].flat().some(e => e?.t === 'keydown' || e?.t === 'keyup')) meta.keyMessages++
      })
    })
  }
  async addIceCandidate(c) {
    try { await super.addIceCandidate(c); note('remote ICE:accepted') }
    catch (err) { note(`remote ICE:${err.name}`); throw err }
  }
}

const [rtc, remote, quality] = await Promise.all([
  import('./src/services/webrtc'), import('./src/services/remoteControl'), import('./src/services/screenShare'),
])
const video = document.createElement('video')
video.muted = video.autoplay = true
video.width = 320
video.height = 180
if (role === 'viewer') {
  document.body.append(video)
  const onFrame = (_now, meta) => {
    latestPresent++
    if (observing) times.push(meta.presentationTime)
    video.requestVideoFrameCallback(onFrame)
  }
  video.requestVideoFrameCallback(onFrame)
}
function newSource(preset) {
  const { width, height, fps } = quality.QUALITY[preset]
  sourceRate = { width, height, fps }
  const c = document.createElement('canvas')
  c.width = width; c.height = height
  c.style.width = '320px'
  c.style.height = '180px'
  document.body.replaceChildren(c)
  const ctx = c.getContext('2d', { alpha: false })
  const draw = () => {
    drawCount++
    ctx.fillStyle = '#20314c'; ctx.fillRect(0, 0, width, height)
    for (let i = 0; i < 28; i++) {
      ctx.fillStyle = ['#fb4658', '#77dfb1', '#5c9ff5'][i % 3]
      ctx.fillRect((drawCount * (i % 7 + 1) + i * 107) % width, (i * 67) % height, 90, 36)
    }
    raf = requestAnimationFrame(draw)
  }
  draw()
  const stream = c.captureStream(fps)
  stream.getVideoTracks()[0].contentHint = 'motion'
  return stream
}
const peer = {
  async startHost(id, preset) {
    await quality.setQuality(preset)
    source = newSource(preset)
    handle = await rtc.startHostPeer(id, source, events => {
      for (const e of events) if (e.t === 'keydown' || e.t === 'keyup') keys.push(`${e.t}:${e.k}`) // inert sink
    }, ok => note(`app:${ok}`))
  },
  async session() {
    const s = await remote.startSession('loopback-host')
    if (!s.ok || !(await remote.verifyPin('000000')).ok) throw Error('mock PIN/session failed')
    return s.id
  },
  connect() {
    return remote.connectPeer(stream => {
      video.srcObject = stream
      void video.play().catch(e => { if (e.name !== 'AbortError') parent.loopError(`video.play: ${e}`) })
    }, ok => note(`app:${ok}`))
  },
  sendKey(t, k) { remote.sendEvent({ t, k, mods: [] }) },
  closeTransport() { pcs.at(-1).close() },
  async end() {
    if (role === 'viewer') { await remote.endSession(); video.srcObject = null }
    else { handle?.close(); cancelAnimationFrame(raf); source?.getTracks().forEach(t => t.stop()) }
  },
  startFrames() { times = []; observing = true },
  endFrames() { observing = false; return times },
  observations() {
    return { present: latestPresent, draws: drawCount, sourceRate, transitions, channels, keys,
      connections: pcs.map(pc => ({ connection: pc.connectionState, signalling: pc.signalingState })) }
  },
  async senderSample() {
    const pc = pcs.at(-1), stats = await pc.getStats()
    const outbound = [...stats.values()].find(r => r.type === 'outbound-rtp' && r.kind === 'video')
    if (!outbound) return null
    const { qualityLimitationReason, qualityLimitationDurations, encoderImplementation, hardwareAccelerated, framesEncoded } = outbound
    return { qualityLimitationReason, qualityLimitationDurations, encoderImplementation, hardwareAccelerated, framesEncoded }
  },
  async sample() {
    const pc = pcs.at(-1)
    if (!pc || pc.connectionState !== 'connected') return null
    // Exercise the same session-owned stats getter as the viewer UI when this
    // revision exports one; the frozen baseline predates that API.
    const stats = remote.getViewerStats ? await remote.getViewerStats() : await pc.getStats()
    if (!stats) return null
    const reports = [...stats.values()]
    const v = reports.find(r => r.type === 'inbound-rtp' && r.kind === 'video')
    if (!v) return null
    const transport = stats.get(v.transportId), pair = stats.get(transport?.selectedCandidatePairId)
    const candidate = id => { const c = stats.get(id); return c && `${c.candidateType}/${c.protocol}` }
    return { timestamp: v.timestamp, decoded: v.framesDecoded, received: v.framesReceived,
      width: v.frameWidth, height: v.frameHeight, videoWidth: video.videoWidth, videoHeight: video.videoHeight,
      codec: stats.get(v.codecId)?.mimeType, selectedPath: pair && [candidate(pair.localCandidateId), candidate(pair.remoteCandidateId)],
      packetsLost: v.packetsLost, dropped: v.framesDropped, bytes: v.bytesReceived }
  },
}
parent.peerReady(role, peer)
