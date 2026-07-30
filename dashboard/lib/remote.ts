/**
 * Shared rules for remote-control sessions.
 *
 * Lives here rather than in a route file because Next.js only allows route
 * modules to export its own known handlers — and both the session and input
 * routes need to agree on when a session is abandoned.
 */

/**
 * A session whose viewer hasn't checked in for this long is dead.
 *
 * This is the safety net for the case that matters: the driving machine
 * crashes, loses Wi-Fi, or is closed mid-session. Without an expiry, the
 * target would sit there indefinitely believing it's still being controlled.
 */
export const SESSION_STALE_MS = 20_000
