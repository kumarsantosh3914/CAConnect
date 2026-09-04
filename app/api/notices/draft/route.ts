import { NextResponse, type NextRequest } from 'next/server'
import { getApiUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getAiProvider, AiError } from '@/lib/ai/provider'
import { PDF_LIMITS } from '@/lib/notices/pdf'

export const runtime = 'nodejs'
export const maxDuration = 60

// A draft is a paid API call, so cap how fast one CA can spend.
const RATE = { perWindow: 12, windowMs: 60_000 }
const attempts = new Map<string, { count: number; resetAt: number }>()

function rateLimited(userId: string): boolean {
  const now = Date.now()
  const entry = attempts.get(userId)
  if (!entry || entry.resetAt < now) {
    attempts.set(userId, { count: 1, resetAt: now + RATE.windowMs })
    return false
  }
  entry.count += 1
  return entry.count > RATE.perWindow
}

export async function POST(request: NextRequest) {
  // Auth before any work at all, per CLAUDE.md.
  const user = await getApiUser()
  if (!user) {
    return NextResponse.json({ error: 'Your session has expired. Please log in again.' }, { status: 401 })
  }
  if (rateLimited(user.id)) {
    return NextResponse.json(
      { error: 'You have generated a lot of drafts in the last minute. Please pause briefly.' },
      { status: 429 }
    )
  }

  let body: { noticeId?: string; noticeText?: string; noticeType?: string; clientId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'That request could not be read.' }, { status: 400 })
  }

  const noticeText = (body.noticeText ?? '').trim()
  if (noticeText.length < PDF_LIMITS.minExtractedChars) {
    return NextResponse.json(
      { error: 'There is not enough text here to work from. Paste the full notice.' },
      { status: 400 }
    )
  }
  if (noticeText.length > PDF_LIMITS.maxChars) {
    return NextResponse.json(
      { error: 'That notice is very long. Paste just the pages that raise queries.' },
      { status: 413 }
    )
  }

  const supabase = await createClient()

  // Client name is looked up through RLS, so a CA cannot pull another firm's
  // client into their prompt by guessing an id.
  let clientName: string | null = null
  if (body.clientId) {
    const { data } = await supabase
      .from('clients')
      .select('name')
      .eq('id', body.clientId)
      .maybeSingle()
    clientName = data?.name ?? null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('firm_name')
    .eq('id', user.id)
    .maybeSingle()

  let provider
  try {
    provider = await getAiProvider()
  } catch {
    return NextResponse.json(
      { error: 'The AI service is not configured. Please contact support.' },
      { status: 503 }
    )
  }

  const encoder = new TextEncoder()
  let draft = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of provider.draftNoticeResponse({
          noticeText,
          noticeType: body.noticeType ?? null,
          clientName,
          firmName: profile?.firm_name ?? null,
        })) {
          draft += chunk
          controller.enqueue(encoder.encode(chunk))
        }

        // Persist once complete. A half-written draft is worse than none, so
        // this only runs after the stream finishes cleanly.
        if (body.noticeId && draft.trim()) {
          await supabase
            .from('notices')
            .update({ draft_response: draft, model: provider.model })
            .eq('id', body.noticeId)
        }
      } catch (error) {
        const message =
          error instanceof AiError
            ? error.message
            : 'Something went wrong generating the draft. Please try again.'
        // The response has already begun, so the error rides in the body.
        controller.enqueue(encoder.encode(`\n\n[ERROR] ${message}`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
