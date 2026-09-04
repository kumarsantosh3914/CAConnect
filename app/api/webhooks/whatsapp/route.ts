import { NextResponse, type NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { env } from '@/lib/env'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  PUBLIC, UNAUTHENTICATED. The signature check IS the security boundary.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Meta calls this to confirm the callback URL, then again for every delivery
 * receipt. There is no session and no token in the URL, so the only thing
 * separating Meta from anyone who guesses the path is the X-Hub-Signature-256
 * HMAC over the RAW request body.
 *
 * Two rules that are easy to get wrong and fatal if you do:
 *
 *   1. The HMAC must be computed over the exact bytes Meta sent. Parsing the
 *      JSON first and re-serialising it changes key order and whitespace, and
 *      the signature will never match — so this reads request.text() once and
 *      verifies before parsing.
 *   2. The comparison must be constant-time. A === on a hex digest leaks the
 *      correct signature a byte at a time.
 *
 * It is a service-role call site, like the reminder cron, because a webhook
 * has no user to satisfy `firm_id in (select auth_firm_ids())`. It writes
 * exactly one thing: delivery status onto a message_log row we already
 * created. It never inserts, so a forged callback that somehow passed the
 * signature check still could not put data into the system.
 */

export const runtime = 'nodejs'

/** Meta's verification handshake, done once when the callback URL is saved. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const mode = params.get('hub.mode')
  const token = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge')

  const expected = env.whatsappVerifyToken()
  if (!expected) {
    return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 503 })
  }

  if (mode !== 'subscribe' || !token || !challenge || !constantTimeEquals(token, expected)) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 403 })
  }

  // Meta wants the challenge echoed as bare text, not JSON.
  return new NextResponse(challenge, {
    status: 200,
    headers: { 'content-type': 'text/plain' },
  })
}

export async function POST(request: NextRequest) {
  const appSecret = env.whatsappAppSecret()
  if (!appSecret) {
    return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 503 })
  }

  // Read the raw body ONCE, before parsing — see rule 1 above.
  const raw = await request.text()
  const signature = request.headers.get('x-hub-signature-256') ?? ''

  if (!verifySignature(raw, signature, appSecret)) {
    return NextResponse.json({ error: 'Bad signature.' }, { status: 401 })
  }

  let payload: MetaWebhookPayload
  try {
    payload = JSON.parse(raw)
  } catch {
    // Meta retries on non-2xx. Malformed JSON will never parse on a retry, so
    // accept it and move on rather than inviting an endless redelivery loop.
    return NextResponse.json({ ok: true, ignored: 'unparseable body' })
  }

  const statuses = (payload.entry ?? [])
    .flatMap((entry) => entry.changes ?? [])
    .flatMap((change) => change.value?.statuses ?? [])

  if (statuses.length === 0) {
    // Inbound messages and other event types land here. We do not act on
    // client replies yet — that needs a place to show them, which is its own
    // feature — but acknowledging keeps Meta from disabling the subscription.
    return NextResponse.json({ ok: true, updated: 0 })
  }

  const admin = createAdminClient()
  let updated = 0

  for (const status of statuses) {
    if (!status.id || !status.status) continue

    const { error, count } = await admin
      .from('message_log')
      .update(
        {
          status: status.status,
          status_at: status.timestamp
            ? new Date(Number(status.timestamp) * 1000).toISOString()
            : new Date().toISOString(),
          error: status.errors?.[0]?.title ?? null,
        },
        { count: 'exact' }
      )
      .eq('provider_message_id', status.id)

    if (!error) updated += count ?? 0
  }

  return NextResponse.json({ ok: true, updated })
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function verifySignature(raw: string, header: string, secret: string): boolean {
  if (!header.startsWith('sha256=')) return false
  const expected = createHmac('sha256', secret).update(raw).digest('hex')
  return constantTimeEquals(header.slice('sha256='.length), expected)
}

type MetaWebhookPayload = {
  entry?: {
    changes?: {
      value?: {
        statuses?: {
          id?: string
          status?: string
          timestamp?: string
          errors?: { title?: string }[]
        }[]
      }
    }[]
  }[]
}
