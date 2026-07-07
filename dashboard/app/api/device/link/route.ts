import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { clerkEnabled } from '@/lib/auth'
import { dbEnabled } from '@/lib/prisma'
import { createDevice, listDevices, deleteDevice } from '@/lib/db'

/**
 * Device linking (dashboard, authenticated). POST creates a pairing token
 * the user pastes into the desktop app. GET lists the account's devices.
 * DELETE unlinks one.
 */
export const runtime = 'nodejs'

function requireUser() {
  if (!clerkEnabled || !dbEnabled) return { error: 'Accounts not configured', status: 503 as const }
  const { userId } = auth()
  if (!userId) return { error: 'Unauthorized', status: 401 as const }
  return { userId }
}

export async function GET() {
  const u = requireUser()
  if ('error' in u) return NextResponse.json({ error: u.error }, { status: u.status })
  const devices = await listDevices(u.userId)
  // Never leak the token in the list.
  return NextResponse.json(
    devices.map((d) => ({
      id: d.id,
      name: d.name,
      os: d.os,
      status: d.status,
      linked: d.linked,
      voiceEnrolled: d.voiceEnrolled,
      lastSeen: d.lastSeen,
    }))
  )
}

export async function POST() {
  const u = requireUser()
  if ('error' in u) return NextResponse.json({ error: u.error }, { status: u.status })
  const { token } = await createDevice(u.userId)
  return NextResponse.json({ token })
}

export async function DELETE(req: Request) {
  const u = requireUser()
  if ('error' in u) return NextResponse.json({ error: u.error }, { status: u.status })
  const { id } = await req.json().catch(() => ({ id: '' }))
  if (id) await deleteDevice(u.userId, id)
  return NextResponse.json({ ok: true })
}
