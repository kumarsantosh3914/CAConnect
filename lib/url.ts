import 'server-only'
import { headers } from 'next/headers'
import { env } from '@/lib/env'

/**
 * The origin to build client-facing links with.
 *
 * Derived from the request the CA is actually making, so a link generated on
 * www.bevritti.in says www.bevritti.in. Environment variables get this wrong
 * in ways nobody notices: VERCEL_PROJECT_PRODUCTION_URL reports the .vercel.app
 * alias even when a custom domain is attached, and if that alias does not serve
 * the project, every link 404s while the site looks perfectly healthy.
 *
 * Trust model: `x-forwarded-host` and `host` are attacker-controllable on a
 * bare origin server, but this only ever runs behind Vercel, which overwrites
 * both. The value is also never used for redirects or auth — only to render a
 * link the signed-in CA reads before sending. Poisoning it would require
 * already controlling the CA's own request.
 *
 * NEXT_PUBLIC_APP_URL still wins when set, for pinning one canonical domain
 * regardless of which host the CA happened to use.
 */
export async function requestOrigin(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  try {
    const headerList = await headers()
    const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
    if (host) {
      const protocol =
        headerList.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
      return `${protocol}://${host}`.replace(/\/$/, '')
    }
  } catch {
    // No request context — a scheduled job, for instance. Fall through.
  }

  return env.appUrl()
}
