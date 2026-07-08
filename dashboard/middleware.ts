import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Clerk activates only when keys are configured. The token-authed device
 * API (/api/device/*) is cross-origin (the desktop app) and must not be
 * gated by Clerk — we answer its CORS preflight here and let real requests
 * through so their route handlers can add CORS headers.
 */
const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

const isProtected = createRouteMatcher(['/dashboard(.*)'])
const isDeviceApi = createRouteMatcher(['/api/device/(.*)'])

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
}

const preflight = () => new NextResponse(null, { status: 204, headers: CORS })

export default clerkEnabled
  ? clerkMiddleware((auth, req) => {
      if (isDeviceApi(req)) {
        return req.method === 'OPTIONS' ? preflight() : NextResponse.next()
      }
      if (isProtected(req)) {
        const { userId, redirectToSignIn } = auth()
        if (!userId) return redirectToSignIn()
      }
      return NextResponse.next()
    })
  : (req: NextRequest) => {
      const { pathname } = new URL(req.url)
      if (pathname.startsWith('/api/device/') && req.method === 'OPTIONS') return preflight()
      return NextResponse.next()
    }

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/(api|trpc)(.*)'],
}
