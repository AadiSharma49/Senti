import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * Housekeeping for remote-control tables. Nothing here is load-bearing for a
 * live session — it only clears rows that are already dead weight:
 *
 *  - Ended/abandoned RemoteSessions older than a day (cascades to their
 *    RemoteSignal/RemoteInput rows automatically — see schema.prisma).
 *  - ScreenFrame rows nobody has refreshed in over an hour (a frame that old
 *    is a stale screenshot, not a live stream).
 *
 * Call via Vercel Cron (see vercel.json). If CRON_SECRET is set, requests
 * must carry it as `Authorization: Bearer <CRON_SECRET>` — Vercel's own
 * cron invocations do this automatically once the env var exists.
 */
const SESSION_RETENTION_MS = 24 * 60 * 60_000
const ABANDONED_PENDING_MS = 60 * 60_000
const STALE_FRAME_MS = 60 * 60_000

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const now = Date.now()

  const deadSessions = await prisma.remoteSession.deleteMany({
    where: {
      OR: [
        { state: 'ended', endedAt: { lt: new Date(now - SESSION_RETENTION_MS) } },
        { state: 'pending', createdAt: { lt: new Date(now - ABANDONED_PENDING_MS) } },
      ],
    },
  })

  const staleFrames = await prisma.screenFrame.deleteMany({
    where: { updatedAt: { lt: new Date(now - STALE_FRAME_MS) } },
  })

  return NextResponse.json({
    ok: true,
    deletedSessions: deadSessions.count,
    deletedFrames: staleFrames.count,
  })
}
