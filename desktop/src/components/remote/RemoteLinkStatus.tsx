import { useEffect, useState } from 'react'
import { getViewerStats } from '../../services/remoteControl'
import { readVideoStats } from '../../services/remoteVideoStats'

/** Measured here, on the receiving PC. A requested preset is not a measurement. */
export default function RemoteLinkStatus({ rtcReady, playing, hasFallback, jpegFps }: {
  rtcReady: boolean; playing: boolean; hasFallback: boolean; jpegFps: number | null
}) {
  const [sample, setSample] = useState<ReturnType<typeof readVideoStats> | null>(null)
  useEffect(() => {
    if (!rtcReady) { setSample(null); return }
    let alive = true
    let timer: number | undefined
    let previous: RTCStatsReport | undefined
    async function sampleStats() {
      try {
        const report = await getViewerStats()
        if (alive && report) {
          setSample(readVideoStats(report, previous))
          previous = report
        }
      } catch { /* transport can close while stats are being collected */ }
      finally { if (alive) timer = window.setTimeout(sampleStats, 2000) }
    }
    void sampleStats()
    return () => { alive = false; clearTimeout(timer) }
  }, [rtcReady])

  if (!rtcReady || !playing) return <>
    {hasFallback ? 'HTTP JPEG fallback' : 'Waiting for screen'}
    {hasFallback && jpegFps !== null && ` · ${jpegFps.toFixed(1)} new frames/s`}
    {rtcReady ? ' · WebRTC ready, waiting for video' : ' · negotiating WebRTC (check TURN if this persists)'}
  </>
  const details = [sample?.width && `${sample.width}×${sample.height}`, sample?.codec,
    sample?.fps != null && `${Math.round(sample.fps)} fps`, sample?.rttMs != null && `${sample.rttMs} ms RTT`]
  const hint = [sample?.pair, sample?.mbps != null && `${sample.mbps.toFixed(1)} Mbps received`,
    sample?.dropped != null && `${sample.dropped} dropped frames`, sample?.freezes != null && `${sample.freezes} freezes`]
  return <span title={hint.filter(Boolean).join(' · ')}>{['WebRTC', sample?.path, ...details].filter(Boolean).join(' · ')}</span>
}
