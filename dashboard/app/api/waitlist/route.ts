import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

/**
 * Waitlist capture. Stores signups in data/waitlist.json (git-ignored).
 *
 * This file-based store works when Senti's dashboard runs on a persistent
 * host (self-hosted / a VM / `next start` on a box). On ephemeral
 * serverless (e.g. Vercel) the file does not persist between invocations —
 * swap `readList`/`writeList` for the real database (or a form service)
 * when we wire the backend.
 */
export const runtime = 'nodejs'

const DATA_DIR = path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'waitlist.json')
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

interface Entry {
  email: string
  source?: string
  ts: string
}

async function readList(): Promise<Entry[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8')) as Entry[]
  } catch {
    return []
  }
}

async function writeList(list: Entry[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(FILE, JSON.stringify(list, null, 2))
}

export async function POST(req: Request) {
  let email = ''
  let source: string | undefined
  try {
    const body = await req.json()
    email = String(body?.email ?? '').trim().toLowerCase()
    source = body?.source ? String(body.source).slice(0, 60) : undefined
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 })
  }

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ ok: false, error: 'Enter a valid email address.' }, { status: 400 })
  }

  try {
    const list = await readList()
    if (!list.some((e) => e.email === email)) {
      list.push({ email, source, ts: new Date().toISOString() })
      await writeList(list)
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not save right now. Try again.' }, { status: 500 })
  }
}

/** Returns only the signup count — never the email list. */
export async function GET() {
  const list = await readList()
  return NextResponse.json({ ok: true, count: list.length })
}
