import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { promises as fs } from 'fs'
import path from 'path'
import { DEFAULT_POLICY, normalizePolicy, type Policy } from '@/lib/policy'
import { clerkEnabled } from '@/lib/auth'
import { dbEnabled } from '@/lib/prisma'
import { getOrCreatePolicy, updatePolicy } from '@/lib/db'

/**
 * Account policy API — the dashboard's authenticated user reads and writes
 * their own policy (stored per-account in the DB). When Clerk/DB aren't
 * configured it falls back to a single shared file-store policy so the app
 * still runs in early dev.
 */
export const runtime = 'nodejs'

const FILE = path.join(process.cwd(), 'data', 'policy.json')

async function readFilePolicy(): Promise<Policy> {
  try {
    return normalizePolicy(JSON.parse(await fs.readFile(FILE, 'utf8')))
  } catch {
    return DEFAULT_POLICY
  }
}
async function writeFilePolicy(p: Policy): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true })
  await fs.writeFile(FILE, JSON.stringify(p, null, 2))
}

const useAccounts = clerkEnabled && dbEnabled

export async function GET() {
  if (useAccounts) {
    const { userId } = auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const user = await currentUser()
    const name = user?.firstName || user?.fullName || undefined
    const policy = await getOrCreatePolicy(userId, user?.primaryEmailAddress?.emailAddress, name)
    return NextResponse.json(policy)
  }
  return NextResponse.json(await readFilePolicy())
}

export async function POST(req: Request) {
  let patch: unknown = {}
  try {
    patch = await req.json()
  } catch {
    // empty patch is fine
  }

  if (useAccounts) {
    const { userId } = auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const saved = await updatePolicy(userId, patch as Partial<Policy>)
    return NextResponse.json(saved)
  }

  const next = normalizePolicy({ ...(await readFilePolicy()), ...(patch as object) })
  await writeFilePolicy(next)
  return NextResponse.json(next)
}
