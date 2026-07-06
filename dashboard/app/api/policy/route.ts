import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { DEFAULT_POLICY, normalizePolicy, type Policy } from '@/lib/policy'

/**
 * Security policy API — the dashboard writes it, the desktop reads it.
 * Stored in data/policy.json (git-ignored). CORS-open so the desktop
 * (a different localhost origin in dev) can fetch it. Swap the file store
 * for the DB, and open only to authenticated accounts, when the backend
 * lands.
 */
export const runtime = 'nodejs'

const FILE = path.join(process.cwd(), 'data', 'policy.json')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

async function readPolicy(): Promise<Policy> {
  try {
    return normalizePolicy(JSON.parse(await fs.readFile(FILE, 'utf8')))
  } catch {
    return DEFAULT_POLICY
  }
}

export async function GET() {
  return NextResponse.json(await readPolicy(), { headers: CORS })
}

export async function POST(req: Request) {
  let patch: unknown = {}
  try {
    patch = await req.json()
  } catch {
    // empty patch is fine
  }
  const next = normalizePolicy({ ...(await readPolicy()), ...(patch as object) })
  await fs.mkdir(path.dirname(FILE), { recursive: true })
  await fs.writeFile(FILE, JSON.stringify(next, null, 2))
  return NextResponse.json(next, { headers: CORS })
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS })
}
