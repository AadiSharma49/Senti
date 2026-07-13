import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Clerk activates only when keys are configured.
 *
 * The device API (/api/device/*) is token-authed and is called by the Senti
 * desktop's Electron MAIN process — a Node client, not a web page. So it is
 * NOT gated by Clerk, and it has no CORS: there is no preflight to answer,
 * because a browser is never supposed to reach it. Each route enforces that
 * itself (lib/deviceAuth.ts rejects any request carrying an Origin header).
 */
const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

const isProtected = createRouteMatcher(['/dashboard(.*)'])
const isDeviceApi = createRouteMatcher(['/api/device/(.*)'])

export default clerkEnabled
  ? clerkMiddleware((auth, req) => {
      if (isDeviceApi(req)) return NextResponse.next()
      if (isProtected(req)) {
        const { userId, redirectToSignIn } = auth()
        if (!userId) return redirectToSignIn()
      }
      return NextResponse.next()
    })
  : (_req: NextRequest) => NextResponse.next()

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/(api|trpc)(.*)'],
}
