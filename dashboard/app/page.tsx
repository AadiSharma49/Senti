import { redirect } from 'next/navigation'

/**
 * Entry point. Per the product flow, users authenticate first — the
 * dashboard is the source of truth and the software is downloaded from
 * inside the authenticated area. So the root goes straight to sign-in.
 */
export default function Home() {
  redirect('/login')
}
