/** Receiver measurements, never SDP, IPs, credentials, frames or input contents. */
export function readVideoStats(stats: RTCStatsReport, previous?: RTCStatsReport) {
  const reports = Array.from(stats.values())
  const video = reports.find(r => r.type === 'inbound-rtp' && r.kind === 'video')
  const transport = stats.get(video?.transportId) ?? reports.find(r => r.type === 'transport')
  const pair = stats.get(transport?.selectedCandidatePairId) ?? reports.find(r =>
    r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded')
  const localCandidate = stats.get(pair?.localCandidateId)
  const remoteCandidate = stats.get(pair?.remoteCandidateId)
  const local = localCandidate?.candidateType
  const remote = remoteCandidate?.candidateType
  const path = local === 'relay' || remote === 'relay' ? 'TURN relay' : local && remote ? 'direct' : 'path unknown'
  const before = previous?.get(video?.id)
  const seconds = before && (video.timestamp - before.timestamp) / 1000
  const deltaRate = (field: string) => seconds > 0 && video[field] >= before[field]
    ? (video[field] - before[field]) / seconds : undefined
  return {
    path,
    pair: local && remote && `${local}/${localCandidate.protocol ?? '?'} ↔ ${remote}/${remoteCandidate.protocol ?? '?'}`,
    codec: stats.get(video?.codecId)?.mimeType?.replace(/^video\//i, ''),
    width: video?.frameWidth, height: video?.frameHeight,
    fps: deltaRate('framesDecoded') ?? video?.framesPerSecond,
    mbps: seconds > 0 ? (deltaRate('bytesReceived') ?? 0) * 8 / 1e6 : undefined,
    rttMs: typeof pair?.currentRoundTripTime === 'number' ? Math.round(pair.currentRoundTripTime * 1000) : undefined,
    dropped: video?.framesDropped, freezes: video?.freezeCount,
  }
}
