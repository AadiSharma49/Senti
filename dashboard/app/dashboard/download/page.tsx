import { redirect } from 'next/navigation'

// The download page is public now (/download), so signed-in users go there too.
// Keeping this path as a redirect means old links and the sidebar keep working.
export default function DashboardDownloadRedirect() {
  redirect('/download')
}
