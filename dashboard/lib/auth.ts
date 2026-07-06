/** True when Clerk keys are configured. Gates real auth vs. the local demo flow. */
export const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
