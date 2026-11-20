import config from './config.js'

const peers = {}, errors = [], checks = [], sessions = []
const report = { browser: navigator.userAgent, checks, sessions, errors }
const sleep = ms => new Promise(ok => setTimeout(ok, ms))
const rounded = n => Math.round(n * 10) / 10
const check = (name, ok, required = true) => { checks.push({ name, ok: !!ok, required }); return !!ok }
async function until(test, ms) {
  const end = performance.now() + ms
  do { if (await test()) return true; await sleep(40) } while (performance.now() < end)
  return false
}
async function bounded(promise, label, ms) {
  let timer
  try { return await Promise.race([promise, new Promise((_, no) => { timer = setTimeout(() => no(Error(`timed out: ${label}`)), ms) })]) }
  finally { clearTimeout(timer) }
}
window.loopError = msg => errors.push(String(msg))
window.peerReady = (role, api) => { peers[role] = api }

// This is a fixture, NOT an authentication test. Role-bound mock bridge (not a
// caller-supplied sender ID); PIN activates a specific session. Oldest first,
// at most 50, destructive reads of only messages from the opposite role.
let active, serial = 0
const issued = new Set()
window.makeBridge = role => {
  if (!['viewer', 'host'].includes(role) || issued.has(role)) throw Error('invalid mock identity')
  issued.add(role)
  return async ({ baseUrl, path, method, body, auth }) => {
    const reply = (data, status = 200) => ({ data, status, ok: status >= 200 && status < 300 })
    const url = new URL(path, baseUrl)
    if (baseUrl !== location.origin || url.origin !== location.origin || auth === false) return reply({}, 403)
    const pathName = url.pathname.replace('/api/device/remote/', '')
    if (role === 'viewer' && pathName === 'session' && method === 'POST') {
      if (body.action === 'start' && body.targetDeviceId === 'loopback-host' && !active) {
        active = { id: `loop-${++serial}`, verified: false, viewer: [], host: [], signalCounts: {}, inputHTTP: 0 }
        return reply({ id: active.id, method: 'pin' })
      }
      if (active?.id !== body.id) return reply({}, 403)
      if (body.action === 'verify' && body.pin === '000000') { active.verified = true; return reply({ ok: true }) }
      if (body.action === 'heartbeat' && active.verified) return reply({ ok: true })
      if (body.action === 'end') { active = null; return reply({ ok: true }) }
    }
    const id = body?.id || url.searchParams.get('id')
    if (!active?.verified || active.id !== id) return reply({}, 403)
    if (pathName === 'signal') {
      if (method === 'GET') return reply({ signals: active[role].splice(0, 50) })
      if (method === 'POST' && ['offer', 'answer', 'ice'].includes(body.kind) && typeof body.payload === 'string' && body.payload.length <= 20000) {
        active[role === 'viewer' ? 'host' : 'viewer'].push({ kind: body.kind, payload: body.payload })
        active.signalCounts[body.kind] = (active.signalCounts[body.kind] || 0) + 1
        return reply({ ok: true })
      }
    }
    if (role === 'viewer' && pathName === 'input' && method === 'POST') {
      active.inputHTTP += body.events.length // recorded, NEVER handed to host input sink
      return reply({ ok: true })
    }
    throw Error(`unexpected mock API call: ${role} ${method} ${pathName}`)
  }
}
async function keys(label, pairs) {
  const expected = [], before = peers.host.observations().keys.length, httpBefore = active.inputHTTP
  for (let i = 0; i < pairs; i++) {
    const k = ['ArrowLeft', 'Shift', 'w', 'ArrowRight', 'Alt'][i % 5]
    for (const t of ['keydown', 'keyup']) {
      peers.viewer.sendKey(t, k); expected.push(`${t}:${k}`)
      await sleep(12) // exercise multiple flushes / multiple SCTP messages
    }
  }
  await until(() => peers.host.observations().keys.length >= before + expected.length, 1800)
  const received = peers.host.observations().keys.slice(before)
  const inOrder = received.length === expected.length && expected.every((key, i) => key === received[i])
  check(`${label}: exact key sequence via peer only`, inOrder && active.inputHTTP === httpBefore)
  return { sent: expected.length, received: received.length, inOrder, inputViaHTTP: active.inputHTTP - httpBefore }
}
async function measure(seconds) {
  const v = peers.viewer, start = await v.sample(), draws = peers.host.observations().draws
  if (!start) throw Error('no inbound video RTP stats')
  v.startFrames()
  await sleep(seconds * 1000)
  const times = v.endFrames(), end = await v.sample()
  if (!end) throw Error('lost inbound video during measurement')
  const duration = (end.timestamp - start.timestamp) / 1000
  const gaps = times.slice(1).map((t, i) => t - times[i]).sort((a, b) => a - b)
  const percentile = q => gaps.length ? rounded(gaps[Math.ceil(q * gaps.length) - 1]) : null
  const metrics = {
    seconds: rounded(duration), decodedFrames: end.decoded - start.decoded,
    receivedFPS: rounded((end.received - start.received) / duration),
    decodedFPS: rounded((end.decoded - start.decoded) / duration), presentationCallbacks: times.length,
    sourceDrawFPS: rounded((peers.host.observations().draws - draws) / duration),
    frameGapMs: { p50: percentile(.50), p95: percentile(.95), max: percentile(1) },
    dimensions: [end.width, end.height], initialDimensions: [start.width, start.height], videoElement: [end.videoWidth, end.videoHeight],
    sender: await peers.host.senderSample(),
    codec: end.codec, selectedPath: end.selectedPath, payloadMbps: rounded((end.bytes - start.bytes) * 8 / duration / 1e6),
    packetsLost: end.packetsLost - start.packetsLost, droppedFrames: end.dropped - start.dropped,
  }
  check('moving video received, decoded and presented', metrics.receivedFPS > 0 && metrics.decodedFrames > 1 && gaps.length > 0 && end.width > 0 && end.height > 0)
  check('negotiated codec and selected ICE path observed', !!metrics.codec && metrics.selectedPath?.every(Boolean))
  return metrics
}
async function runSession(first) {
  const { host, viewer } = peers
  const id = await viewer.session(), s = { id }
  sessions.push(s)
  const initial = viewer.observations().present
  const hostStart = host.observations().transitions.length, viewerStart = viewer.observations().transitions.length
  const channelStart = host.observations().channels.length
  try {
    await host.startHost(id, config.preset)
    s.source = host.observations().sourceRate
    const t = performance.now()
    if (!await bounded(viewer.connect(), 'viewer connect', 18000)) throw Error('connectPeer returned false')
    if (!await until(() => viewer.observations().present > initial + 2, 6000)) throw Error('no new video presentation')
    s.connectToThirdPresentationMs = Math.round(performance.now() - t)
    if (first) {
      await sleep(1200) // capture/encoder warm-up, not part of measurement
      s.metrics = await measure(config.seconds)
    }
    s.keys = await keys(id, first ? 32 : 4)
    const used = host.observations().channels.slice(channelStart).filter(c => c.keyMessages > 0)
    s.keyChannel = used.at(-1)
    check(`${id}: keys on ordered/reliable SCTP channel`, s.keyChannel?.ordered && s.keyChannel.maxRetransmits == null && s.keyChannel.maxPacketLifeTime == null, config.strict)
    if (first) {
      // Kill the real transport only, not the session or its signalling listener.
      // No synthetic state events, new offers, or harness-driven connectPeer retry.
      const oldOffers = active.signalCounts.offer, oldAnswers = active.signalCounts.answer
      const oldPCs = viewer.observations().connections.length
      const lostAt = performance.now(), cut = viewer.observations().transitions.length
      host.closeTransport()
      const recovered = await until(async () => viewer.observations().connections.length > oldPCs &&
        active.signalCounts.offer > oldOffers && active.signalCounts.answer > oldAnswers && (await viewer.sample())?.decoded >= 3, 12000)
      const readiness = viewer.observations().transitions.slice(cut).map(e => e.state).filter(s => s.startsWith('app:'))
      s.transportClose = { recovered, readiness, waitMs: Math.round(performance.now() - lostAt), maxWaitMs: 12000 }
      check('viewer readiness callback reports loss then recovery', readiness.join(',') === 'app:false,app:true', config.strict)
      check('same-session automatic renegotiation + decoded video after host transport close', recovered, config.strict)
      if (recovered) {
        const n = viewer.observations().present
        check('new video presented after recovery', await until(() => viewer.observations().present > n + 2, 2000))
        s.transportClose.keys = await keys('recovered', 4)
      }
    }
  } finally {
    // Sample state before/after teardown without logging any SDP, credentials or candidate IPs.
    s.signals = { ...active?.signalCounts }
    try { await viewer.end() } finally { await host.end() }
    const relevant = events => s.metrics || s.keys ? events.filter(e => /^(app|connectionState):/.test(e.state)) : events
    s.viewerTransitions = relevant(viewer.observations().transitions.slice(viewerStart))
    s.hostTransitions = relevant(host.observations().transitions.slice(hostStart))
    check(`${id}: all native connections closed on hangup`, [host, viewer].every(p => p.observations().connections.every(c => c.signalling === 'closed')))
  }
}
try {
  for (const role of ['host', 'viewer']) {
    const frame = document.createElement('iframe')
    frame.width = 352; frame.height = 216; frame.src = `./peer.html?role=${role}`
    document.body.append(frame)
  }
  if (!await until(() => peers.host && peers.viewer, 12000)) throw Error('peer fixture failed to load')
  await runSession(true)
  await runSession(false) // fresh verified session on the same module instances
} catch (e) { errors.push(String(e.stack || e)) }
report.pass = !errors.length && checks.every(c => !c.required || c.ok)
await fetch('./result', { method: 'POST', body: JSON.stringify(report) })
