/**
 * Validates every credential in .env against its real API.
 *
 * This exists because silent key corruption cost real hours: a stray edit
 * dropped the leading "s" from two sk_... keys. Clerk then failed server-side
 * only, giving a blank page and a redirect loop with nothing in the logs; and
 * ElevenLabs 401'd on every call, so Senti quietly fell back to the robotic
 * browser voice and the AI voice "just sounded bad" instead of erroring.
 *
 * A wrong key should be loud, not mysterious.
 *
 *   npm run check:env
 */
import { readFileSync, existsSync } from 'fs'

if (!existsSync('.env')) {
  console.error('No .env found. Copy .env.example to .env and fill it in.')
  process.exit(1)
}

const env = readFileSync('.env', 'utf8')
const get = (k) => {
  const m = env.match(new RegExp('^\\s*' + k + '\\s*=\\s*(.*)$', 'm'))
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
}

const results = []
const add = (name, ok, detail) => results.push({ name, ok, detail })

// --- shape checks (catch corruption before we even call out) ---
const shapes = [
  ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', /^pk_(test|live)_/, 'must start with pk_test_ / pk_live_'],
  ['CLERK_SECRET_KEY', /^sk_(test|live)_/, 'must start with sk_test_ / sk_live_'],
  ['GROQ_API_KEY', /^gsk_/, 'must start with gsk_'],
  ['ELEVENLABS_API_KEY', /^sk_/, 'must start with sk_'],
  ['SENTI_ENCRYPTION_KEY', /^[0-9a-f]{64}$/i, 'must be 64 hex chars'],
]
for (const [key, re, why] of shapes) {
  const v = get(key)
  if (!v) add(key, null, 'not set')
  else if (!re.test(v)) add(key, false, `MALFORMED — ${why} (got "${v.slice(0, 6)}...")`)
}

// --- live checks ---
async function check(name, fn) {
  try {
    const r = await fn()
    add(name, r.ok, r.detail)
  } catch (e) {
    add(name, false, e.message.slice(0, 60))
  }
}

const clerk = get('CLERK_SECRET_KEY')
const groq = get('GROQ_API_KEY')
const eleven = get('ELEVENLABS_API_KEY')
const voice = get('ELEVENLABS_VOICE_ID')
const db = get('DATABASE_URL')

await Promise.all([
  clerk &&
    check('Clerk (auth)', async () => {
      const r = await fetch('https://api.clerk.com/v1/users?limit=1', {
        headers: { Authorization: `Bearer ${clerk}` },
      })
      return { ok: r.ok, detail: r.ok ? 'valid' : `REJECTED (${r.status}) — sign-in will break` }
    }),

  groq &&
    check('Groq (brain)', async () => {
      const r = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${groq}` },
      })
      return { ok: r.ok, detail: r.ok ? 'valid' : `REJECTED (${r.status}) — Senti cannot think` }
    }),

  eleven &&
    check('ElevenLabs (voice)', async () => {
      // Test the thing we actually use. Don't probe /user/subscription: a key
      // scoped to text_to_speech only will 401 there while working perfectly.
      const t = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice || 'nPczCjzI2devNBz1zQrb'}`, {
        method: 'POST',
        headers: { 'xi-api-key': eleven, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text: 'Check.', model_id: 'eleven_turbo_v2_5' }),
      })
      if (t.ok) return { ok: true, detail: `valid — voice ${voice} speaks` }
      if (t.status === 401)
        return { ok: false, detail: 'REJECTED (401) — Senti falls back to the robotic browser voice' }
      if (t.status === 402)
        return { ok: false, detail: `voice ${voice} needs a PAID plan (Voice Library) — pick a premade voice` }
      return { ok: false, detail: `voice call failed (${t.status})` }
    }),

  db &&
    check('Neon (database)', async () => {
      if (!/pgbouncer=true/.test(db) && /-pooler/.test(db))
        return { ok: false, detail: 'pooled URL missing ?pgbouncer=true — connections will drop' }
      const { PrismaClient } = await import('@prisma/client')
      const p = new PrismaClient()
      await p.user.count()
      await p.$disconnect()
      return { ok: true, detail: 'connected' }
    }),
].filter(Boolean))

// --- report ---
console.log('\nSenti environment check\n')
let bad = 0
for (const r of results) {
  const mark = r.ok === true ? 'OK  ' : r.ok === false ? 'FAIL' : '--  '
  if (r.ok === false) bad++
  console.log(`  ${mark} ${r.name.padEnd(36)} ${r.detail}`)
}
console.log()
if (bad) {
  console.error(`${bad} problem(s) found. Senti will misbehave until these are fixed.\n`)
  process.exit(1)
}
console.log('All configured credentials are valid.\n')
