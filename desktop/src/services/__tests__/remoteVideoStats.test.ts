import { describe, it, expect } from 'vitest'
import { readVideoStats } from '../remoteVideoStats'

// Selected pair only: a successful but unused TURN check says nothing about the active path.
const report = (framesDecoded: number, timestamp: number, remoteType = 'host') => new Map([
  ['v', { id: 'v', type: 'inbound-rtp', kind: 'video', transportId: 't', codecId: 'c', timestamp, framesDecoded,
    bytesReceived: 1000 * framesDecoded, frameWidth: 1280, frameHeight: 720 }],
  ['c', { type: 'codec', mimeType: 'video/H264' }],
  ['unused', { type: 'candidate-pair', state: 'succeeded', nominated: true, remoteCandidateId: 'turn' }],
  ['t', { type: 'transport', selectedCandidatePairId: 'chosen' }],
  ['chosen', { type: 'candidate-pair', localCandidateId: 'lc', remoteCandidateId: 'rc', currentRoundTripTime: 0.012 }],
  ['lc', { type: 'local-candidate', candidateType: 'host' }], ['rc', { type: 'remote-candidate', candidateType: remoteType }],
  ['turn', { type: 'remote-candidate', candidateType: 'relay' }],
] as [string, Record<string, unknown>][]) as unknown as RTCStatsReport

describe('viewer diagnostics', () => {
  it('reports decoded frame rate and negotiated path, not the requested preset', () => {
    expect(readVideoStats(report(120, 3000), report(60, 1000))).toMatchObject({
      path: 'direct', fps: 30, mbps: 0.24, codec: 'H264', rttMs: 12, width: 1280, height: 720,
    })
  })
  it('recognizes remote-side TURN, and 0 decoded frames on a stalled transport', () => {
    expect(readVideoStats(report(60, 3000, 'relay'), report(60, 1000))).toMatchObject({ path: 'TURN relay', fps: 0 })
  })
  it('does not guess direct when ICE stats are unavailable', () => {
    expect(readVideoStats(new Map() as RTCStatsReport)).toMatchObject({ path: 'path unknown' })
  })
})
