/**
 * Clerk configuration, with a loud check on the key SHAPES.
 *
 * A malformed secret key fails in the nastiest possible way: the client-side
 * Clerk sees a valid session, the server cannot verify it, so middleware
 * decides you're signed out and bounces you to /login — which then tries to
 * send you back to /dashboard. You get a redirect loop and a blank page, with
 * nothing in the logs saying "your key is wrong". (This happened: a stray edit
 * dropped the leading `s` from sk_test_..., and it cost real debugging time.)
 *
 * So: validate the format at boot and say so plainly.
 */
const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ''
const secret = process.env.CLERK_SECRET_KEY || ''

/** True when Clerk keys are configured. Gates real auth vs. the local demo flow. */
export const clerkEnabled = !!publishable

if (publishable && !/^pk_(test|live)_/.test(publishable)) {
  console.error(
    '[senti] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is malformed — it must start with "pk_test_" or "pk_live_". Sign-in will not work.'
  )
}

if (publishable && secret && !/^sk_(test|live)_/.test(secret)) {
  console.error(
    '[senti] CLERK_SECRET_KEY is malformed — it must start with "sk_test_" or "sk_live_". ' +
      'The browser will think you are signed in while the server does not, giving a redirect loop and a blank page.'
  )
}

if (publishable && !secret) {
  console.error('[senti] CLERK_SECRET_KEY is missing. The server cannot verify sessions.')
}
