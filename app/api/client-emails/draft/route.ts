import { NextResponse, type NextRequest } from 'next/server'
import { getApiUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getAiProvider, AiError } from '@/lib/ai/provider'
import { checkAiGuards } from '@/lib/ai/guard'
import { CLIENT_EMAIL_SYSTEM_PROMPT, buildClientEmailUserPrompt, splitSubjectAndBody } from '@/lib/ai/prompts/client-email'
import { buildEmailContext } from '@/lib/client-emails/context'
import type { ClientEmailTopic } from '@/types/database'

export const runtime = 'nodejs'
export const maxDuration = 60

const TOPICS: ClientEmailTopic[] = ['deadline_reminder', 'document_followup', 'fee_reminder', 'custom']

export async function POST(request: NextRequest) {
  // Auth before any work at all, per CLAUDE.md.
  const user = await getApiUser()
  if (!user) {
    return NextResponse.json({ error: 'Your session has expired. Please log in again.' }, { status: 401 })
  }

  let body: {
    emailId?: string
    clientId?: string
    topic?: string
    subjectId?: string
    notes?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'That request could not be read.' }, { status: 400 })
  }

  if (!body.clientId) {
    return NextResponse.json({ error: 'Pick a client.' }, { status: 400 })
  }
  if (!body.topic || !TOPICS.includes(body.topic as ClientEmailTopic)) {
    return NextResponse.json({ error: 'Pick a topic.' }, { status: 400 })
  }
  const topic = body.topic as ClientEmailTopic
  if (topic === 'custom' && !body.notes?.trim()) {
    return NextResponse.json({ error: 'Describe what this email is about.' }, { status: 400 })
  }

  const supabase = await createClient()

  const guard = await checkAiGuards(supabase, user.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  // Client name is looked up through RLS, so a CA cannot pull another firm's
  // client into their prompt by guessing an id.
  const { data: client } = await supabase
    .from('clients')
    .select('name')
    .eq('id', body.clientId)
    .maybeSingle()
  if (!client) {
    return NextResponse.json({ error: 'That client could not be found.' }, { status: 404 })
  }

  const context = await buildEmailContext(topic, body.clientId, body.subjectId ?? null)
  if (!context.ok) {
    return NextResponse.json({ error: context.error }, { status: 400 })
  }

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
        for await (const chunk of provider.streamText({
          instructions: CLIENT_EMAIL_SYSTEM_PROMPT,
          input: buildClientEmailUserPrompt({
            clientName: client.name,
            firmName: guard.firmName,
            notes: body.notes ?? null,
            facts: context.facts,
          }),
          maxOutputTokens: 1200,
        })) {
          draft += chunk
          controller.enqueue(encoder.encode(chunk))
        }

        // Persist once complete. A half-written draft is worse than none, so
        // this only runs after the stream finishes cleanly.
        if (body.emailId && draft.trim()) {
          const { subject, body: emailBody } = splitSubjectAndBody(draft)
          await supabase
            .from('client_emails')
            .update({ draft_subject: subject, draft_body: emailBody, model: provider.model })
            .eq('id', body.emailId)
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
