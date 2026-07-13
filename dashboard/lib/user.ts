import { auth, currentUser } from '@clerk/nextjs/server'
import { clerkEnabled } from './auth'
import { dbEnabled, prisma } from './prisma'

/**
 * The signed-in person, guaranteed to exist in our database.
 *
 * Every table (Device, Policy, VoiceProfile, UnlockEvent) hangs off User by
 * foreign key, but Clerk owns the sign-up — so on their very first action a
 * real user has no row here yet, and any write blows up with a foreign key
 * violation. This upserts them from Clerk first, and captures their real name
 * so Senti can greet them by it.
 *
 * Call this before ANY authenticated write, and on dashboard load.
 */

/** How Senti should address them out loud. First name if we have it. */
function displayName(user: Awaited<ReturnType<typeof currentUser>>): string | null {
  if (!user) return null
  return user.firstName || user.fullName || user.username || null
}

export interface SentiUser {
  userId: string
  name: string | null
  email: string | null
}

/** Upsert the signed-in Clerk user into the DB. Null when not signed in. */
export async function ensureUser(): Promise<SentiUser | null> {
  if (!clerkEnabled || !dbEnabled) return null
  const { userId } = auth()
  if (!userId) return null

  const clerk = await currentUser()
  const name = displayName(clerk)
  const email = clerk?.primaryEmailAddress?.emailAddress ?? null

  await prisma.user.upsert({
    where: { id: userId },
    // Keep the name/email fresh, but never overwrite good data with nulls.
    update: { ...(email ? { email } : {}), ...(name ? { name } : {}) },
    create: { id: userId, email, name },
  })

  return { userId, name, email }
}
