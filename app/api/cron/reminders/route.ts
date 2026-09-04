import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { deadlineReminderEmail, documentNudgeEmail } from '@/lib/email/templates'
import { env } from '@/lib/env'

/**
 * Daily reminder run, triggered by Vercel Cron (see vercel.json).
 *
 * Guarded by CRON_SECRET rather than a session, because there is no user
 * here. It reads across every CA's data, so it is the third service-role
 * call site — a scheduled job cannot satisfy `user_id = auth.uid()`.
 *
 * Duplicate sends are prevented by a unique index on
 * email_log(kind, subject_id, variant): the insert is attempted BEFORE the
 * send, so a retry or an overlapping run cannot double-mail a client.
 */

export const runtime = 'nodejs'
export const maxDuration = 60

/** Constant-time compare so the secret cannot be guessed a byte at a time. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function daysUntil(dateString: string): number {
  const due = new Date(dateString)
  const today = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((startOfDay(due).getTime() - startOfDay(today).getTime()) / 86_400_000)
}

export async function GET(request: NextRequest) {
  const header = request.headers.get('authorization') ?? ''
  const provided = header.replace(/^Bearer\s+/i, '')

  let expected: string
  try {
    expected = env.cronSecret()
  } catch {
    return NextResponse.json({ error: 'Cron is not configured.' }, { status: 503 })
  }
  if (!provided || !secretMatches(provided, expected)) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 })
  }

  const admin = createAdminClient()

  // There is no foreign key from deadlines.user_id to profiles (it references
  // auth.users), so PostgREST cannot join them. Load firm names once and map.
  const { data: profiles } = await admin.from('profiles').select('id,firm_name')
  const firmNames = new Map((profiles ?? []).map((p) => [p.id, p.firm_name]))

  const sent: string[] = []
  const skipped: string[] = []
  const failed: string[] = []

  /** Claims a send. Returns false if this exact email already went out. */
  async function claim(kind: string, subjectId: string, variant: string, userId: string, recipient: string) {
    const { error } = await admin
      .from('email_log')
      .insert({ kind, subject_id: subjectId, variant, user_id: userId, recipient })
    // 23505 = unique violation = already sent. Anything else is a real error.
    return !error
  }

  // ── Deadline reminders at T-7 and T-1 ──────────────────────────────────
  const horizon = new Date()
  horizon.setDate(horizon.getDate() + 7)

  const { data: deadlines } = await admin
    .from('deadlines')
    .select('id,user_id,label,period_label,due_date,status,clients(name,email)')
    .in('status', ['pending', 'in_progress'])
    .gte('due_date', new Date().toISOString().slice(0, 10))
    .lte('due_date', horizon.toISOString().slice(0, 10))

  for (const deadline of deadlines ?? []) {
    const email = deadline.clients?.email
    if (!email) {
      skipped.push(`deadline ${deadline.id}: client has no email`)
      continue
    }
    const days = daysUntil(deadline.due_date)
    const variant = days <= 1 ? 't-1' : days <= 7 ? 't-7' : null
    if (!variant) continue

    if (!(await claim('deadline', deadline.id, variant, deadline.user_id, email))) {
      skipped.push(`deadline ${deadline.id} (${variant}): already sent`)
      continue
    }

    const firmName = firmNames.get(deadline.user_id) ?? 'Your CA'
    const { subject, html } = deadlineReminderEmail({
      clientName: deadline.clients?.name ?? 'Client',
      firmName,
      label: deadline.label,
      periodLabel: deadline.period_label,
      dueDate: deadline.due_date,
      daysAway: days,
    })

    const result = await sendEmail({ to: email, subject, html })
    if (result.ok) sent.push(`deadline ${deadline.id} (${variant})`)
    else {
      failed.push(`deadline ${deadline.id}: ${result.error}`)
      // Release the claim so tomorrow's run retries rather than skipping.
      await admin
        .from('email_log')
        .delete()
        .eq('kind', 'deadline')
        .eq('subject_id', deadline.id)
        .eq('variant', variant)
    }
  }

  // ── Document requests idle 3+ days ─────────────────────────────────────
  const idleSince = new Date()
  idleSince.setDate(idleSince.getDate() - 3)

  const { data: requests } = await admin
    .from('document_requests')
    .select('id,user_id,title,token,created_at,expires_at,clients(name,email),document_request_items(label,is_required,fulfilled_document_id)')
    .eq('status', 'open')
    .lte('created_at', idleSince.toISOString())
    .gt('expires_at', new Date().toISOString())

  for (const req of requests ?? []) {
    const email = req.clients?.email
    if (!email) {
      skipped.push(`request ${req.id}: client has no email`)
      continue
    }
    const outstanding = (req.document_request_items ?? [])
      .filter((item) => item.is_required && item.fulfilled_document_id === null)
      .map((item) => item.label)
    if (outstanding.length === 0) continue

    // Weekly cadence, so a slow client is nudged rather than harassed.
    const week = Math.floor(
      (Date.now() - new Date(req.created_at).getTime()) / (7 * 86_400_000)
    )
    const variant = `nudge-${week}`

    if (!(await claim('document_request', req.id, variant, req.user_id, email))) {
      skipped.push(`request ${req.id} (${variant}): already sent`)
      continue
    }

    const { subject, html } = documentNudgeEmail({
      clientName: req.clients?.name ?? 'Client',
      firmName: firmNames.get(req.user_id) ?? 'Your CA',
      title: req.title,
      outstanding,
      uploadUrl: `${env.appUrl()}/upload/${req.token}`,
    })

    const result = await sendEmail({ to: email, subject, html })
    if (result.ok) sent.push(`request ${req.id} (${variant})`)
    else {
      failed.push(`request ${req.id}: ${result.error}`)
      await admin
        .from('email_log')
        .delete()
        .eq('kind', 'document_request')
        .eq('subject_id', req.id)
        .eq('variant', variant)
    }
  }

  return NextResponse.json({
    ok: true,
    sent: sent.length,
    skipped: skipped.length,
    failed: failed.length,
    detail: { sent, skipped, failed },
  })
}
