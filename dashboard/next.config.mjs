/**
 * Security headers. A security product that ships a clickjackable,
 * MIME-sniffable dashboard is not a security product.
 *
 * HSTS is safe here because the deploy is HTTPS-only (Vercel); browsers
 * ignore it over plain HTTP in local dev.
 */
const securityHeaders = [
  // No framing — defeats clickjacking of the dashboard's controls.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  // Don't let the browser guess content types.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Force HTTPS for a year, including subdomains.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Don't leak dashboard URLs (which contain no ids today, but might).
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The dashboard needs none of these.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework version to attackers.
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
