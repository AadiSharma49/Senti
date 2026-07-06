import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

/**
 * Clerk activates only when keys are configured. Without keys the app
 * still runs (the middleware is a pass-through), so the dashboard works
 * before Clerk is set up.
 */
const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

const isProtected = createRouteMatcher(['/dashboard(.*)'])

export default clerkEnabled
  ? clerkMiddleware((auth, req) => {
      if (isProtected(req)) {
        const { userId, redirectToSignIn } = auth()
        if (!userId) return redirectToSignIn()
      }
    })
  : () => NextResponse.next()

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/(api|trpc)(.*)'],
}
