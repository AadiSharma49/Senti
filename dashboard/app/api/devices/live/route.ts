import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { clerkEnabled } from '@/lib/auth'
import { listDevices } from '@/lib/db'

/**
 * Live device status for the signed-in user's own phone/browser (Clerk-authed,
 * NOT the device token). Polled by the Remote page so it updates on its own.
 */
export const runtime = 'nodejs'

export async function GET() {
  const userId = clerkEnabled ? auth().userId : null
  if (!userId) return NextResponse.json({ devices: [] }, { status: 401 })

  const devices = await listDevices(userId)
  return NextResponse.json(
    {
      devices: devices.map((d) => ({
        id: d.id,
        name: d.name,
        os: d.os,
        status: d.status,
        activity: d.activity ?? null,
        vitals: d.vitals ?? null,
        reportedAt: d.reportedAt ? d.reportedAt.toISOString() : null,
        lastSeen: d.lastSeen.toISOString(),
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
