import { Resend } from 'resend'

/**
 * Sending the one-time codes that authorise remote control.
 *
 * Optional by design: with no key configured, remote control falls back to the
 * static PIN set on the target machine. That keeps a fresh clone working
 * without an email account, and means a Resend outage degrades the feature
 * rather than locking you out of your own computer.
 *
 * The key lives only in the environment. There is deliberately no way to pass
 * one in from a request.
 */
const key = process.env.RESEND_API_KEY
export const emailEnabled = !!key

const resend = key ? new Resend(key) : null

/**
 * Resend's shared sender works without owning a domain, but it can only
 * deliver to the address that owns the Resend account. That's exactly the
 * case here — codes go to you — so it's a sensible default. Set
 * RESEND_FROM once you've verified your own domain.
 */
const FROM = process.env.RESEND_FROM || 'Senti <onboarding@resend.dev>'

/** Send a remote-access code. Returns false if it couldn't be delivered. */
export async function sendRemoteCode(to: string, code: string, deviceName: string): Promise<boolean> {
  if (!resend) return false
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `Senti code ${code} — remote access to ${deviceName}`,
      // Plain and specific on purpose: the subject alone tells you what's
      // happening, so an unexpected one is obvious without opening anything.
      html: `
        <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:420px">
          <p style="font-size:15px;color:#111">
            Someone asked to take remote control of <strong>${escapeHtml(deviceName)}</strong>.
          </p>
          <p style="font-size:32px;letter-spacing:8px;font-weight:600;margin:24px 0;color:#000">
            ${escapeHtml(code)}
          </p>
          <p style="font-size:13px;color:#555">
            This code expires in 10 minutes. If this wasn't you, ignore this email —
            without the code nothing can connect.
          </p>
        </div>
      `,
    })
    return !error
  } catch {
    return false
  }
}

/** The device name is ours, but it's user-set — never trust it into HTML raw. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
