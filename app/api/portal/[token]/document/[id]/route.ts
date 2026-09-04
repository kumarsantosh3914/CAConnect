import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { lookupPortalDocument } from '@/lib/portal/public'

/**
 * Hands a portal visitor one of their own documents back.
 *
 * Like the upload route, authorisation is the token, not RLS — see the header
 * of lib/portal/public.ts. Two things make that safe here:
 *
 *   - lookupPortalDocument() re-checks that the requested document belongs to
 *     THIS portal's client. The id in the URL is attacker-controlled; without
 *     that check a valid portal token would read every document in the
 *     database.
 *   - The signed URL is short-lived and points at the private bucket. Nothing
 *     is ever made public.
 *
 * A document that does not belong to this portal 404s exactly like one that
 * does not exist.
 */
export const runtime = 'nodejs'

const RATE_LIMIT = 60
const WINDOW_MS = 60_000
const attempts = new Map<string, { count: number; resetAt: number }>()

function rateLimited(key: string): boolean {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    if (attempts.size > 5000) {
      for (const [k, v] of attempts) if (v.resetAt < now) attempts.delete(k)
    }
    return false
  }
  entry.count += 1
  return entry.count > RATE_LIMIT
}

export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/portal/[token]/document/[id]'>
) {
  const { token, id } = await context.params

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (rateLimited(`p:${token}`) || rateLimited(`pip:${ip}`)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 })
  }

  const found = await lookupPortalDocument(token, id)
  if (!found.ok) {
    return NextResponse.json({ error: 'That document is not available.' }, { status: 404 })
  }

  const admin = createAdminClient()
  const { data: signed, error } = await admin.storage
    .from('client-documents')
    .createSignedUrl(found.path, 60, { download: found.fileName })

  if (error || !signed) {
    return NextResponse.json({ error: 'That document could not be opened.' }, { status: 500 })
  }

  return NextResponse.redirect(signed.signedUrl)
}
