import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { deadlineReminderEmail, documentNudgeEmail } from '@/lib/email/templates'
import { whatsappStatus } from '@/lib/whatsapp/config'
import { sendWhatsAppTemplate } from '@/lib/whatsapp/send'
import { deadlineReminderTemplate, documentRequestTemplate } from '@/lib/whatsapp/templates'
import type { WhatsAppTemplate } from '@/lib/whatsapp/templates'
import { formatDate } from '@/lib/format'
import { env } from '@/lib/env'

/**
 * Daily reminder run, triggered by Vercel Cron (see vercel.json).
 *
 * Guarded by CRON_SECRET rather than a session, because there is no user
 * here. It reads across every CA's data, so it is a service-role call site —
 * a scheduled job cannot satisfy `firm_id in (select auth_firm_ids())`.
 *
 * Duplicate sends are prevented by a unique index on
 * message_log(channel, kind, subject_id, variant): the insert is attempted
 * BEFORE the send, so a retry or an overlapping run cannot double-message a
 * client.
 *
 * ── Channel choice ───────────────────────────────────────────────────────
 * WhatsApp first when it is switched on and the client has a usable number,
 * because India reads WhatsApp and ignores email. Email is the fallback, and
 * remains the only channel until Meta approves the business and templates.
 *
 * A client gets ONE reminder per deadline per variant, not one per channel.
 * If WhatsApp already went out, email is skipped; if WhatsApp fails, email
 * goes instead and the WhatsApp claim is KEPT with the error recorded. That
 * last part is deliberate: releasing it would retry WhatsApp tomorrow and the
 * client would hear about the same filing twice, once per channel.
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
  const whatsapp = whatsappStatus()

  // Firm names for the signature. A single lookup keyed by firm id, which is
  // what the domain rows now carry.
  const { data: firms } = await admin.from('firms').select('id,name')
  const firmNames = new Map((firms ?? []).map((f) => [f.id, f.name]))

  const sent: string[] = []
  const skipped: string[] = []
  const failed: string[] = []

  /**
   * Claims a send, returning the log row id. Null means this exact message
   * already went out on this channel.
   */
  async function claim(
    channel: 'email' | 'whatsapp',
    kind: string,
    subjectId: string,
    variant: string,
    firmId: string,
    recipient: string
  ): Promise<string | null> {
    const { data, error } = await admin
      .from('message_log')
      .insert({ channel, kind, subject_id: subjectId, variant, firm_id: firmId, recipient })
      .select('id')
      .single()
    // 23505 = unique violation = already sent. Anything else is a real error.
    if (error || !data) return null
    return data.id
  }

  async function markSent(id: string, providerMessageId: string) {
    await admin
      .from('message_log')
      .update({ provider_message_id: providerMessageId, status: 'sent' })
      .eq('id', id)
  }

  async function markFailed(id: string, message: string) {
    await admin.from('message_log').update({ status: 'failed', error: message }).eq('id', id)
  }

  async function release(id: string) {
    await admin.from('message_log').delete().eq('id', id)
  }

  /**
   * Tries WhatsApp. Returns whether the client has been reached, so the caller
   * knows whether to fall back to email.
   */
  async function tryWhatsApp(
    kind: string,
    subjectId: string,
    variant: string,
    firmId: string,
    phone: string | null | undefined,
    build: () => WhatsAppTemplate,
    label: string
  ): Promise<boolean> {
    if (!whatsapp.enabled || !phone) return false

    const claimId = await claim('whatsapp', kind, subjectId, variant, firmId, phone)
    // Already messaged on WhatsApp: reached, so do not also email.
    if (!claimId) return true

    const outcome = await sendWhatsAppTemplate({ to: phone, template: build() })

    if (outcome.status === 'sent') {
      await markSent(claimId, outcome.messageId)
      sent.push(`${label} via whatsapp`)
      return true
    }

    if (outcome.status === 'skipped') {
      // Nothing was attempted (unusable number), so leave no claim behind.
      await release(claimId)
      skipped.push(`${label} whatsapp: ${outcome.reason}`)
      return false
    }

    await markFailed(claimId, outcome.error)
    failed.push(`${label} whatsapp: ${outcome.error}`)
    return false
  }

  // ── Deadline reminders at T-7 and T-1 ──────────────────────────────────
  const horizon = new Date()
  horizon.setDate(horizon.getDate() + 7)

  const { data: deadlines } = await admin
    .from('deadlines')
    .select('id,firm_id,label,period_label,due_date,status,clients(name,email,phone)')
    .in('status', ['pending', 'in_progress'])
    .gte('due_date', new Date().toISOString().slice(0, 10))
    .lte('due_date', horizon.toISOString().slice(0, 10))

  for (const deadline of deadlines ?? []) {
    const days = daysUntil(deadline.due_date)
    const variant = days <= 1 ? 't-1' : days <= 7 ? 't-7' : null
    if (!variant) continue

    const clientName = deadline.clients?.name ?? 'Client'
    const firmName = firmNames.get(deadline.firm_id) ?? 'Your CA'

    const reached = await tryWhatsApp(
      'deadline',
      deadline.id,
      variant,
      deadline.firm_id,
      deadline.clients?.phone,
      () =>
        deadlineReminderTemplate({
          clientName,
          firmName,
          label: deadline.label,
          periodLabel: deadline.period_label,
          dueDate: formatDate(deadline.due_date),
        }),
      `deadline ${deadline.id} (${variant})`
    )
    if (reached) continue

    const email = deadline.clients?.email
    if (!email) {
      skipped.push(`deadline ${deadline.id}: client has no email`)
      continue
    }

    const claimId = await claim('email', 'deadline', deadline.id, variant, deadline.firm_id, email)
    if (!claimId) {
      skipped.push(`deadline ${deadline.id} (${variant}): already sent`)
      continue
    }

    const { subject, html } = deadlineReminderEmail({
      clientName,
      firmName,
      label: deadline.label,
      periodLabel: deadline.period_label,
      dueDate: deadline.due_date,
      daysAway: days,
    })

    const result = await sendEmail({ to: email, subject, html })
    if (result.ok) {
      await markSent(claimId, result.id)
      sent.push(`deadline ${deadline.id} (${variant})`)
    } else {
      failed.push(`deadline ${deadline.id}: ${result.error}`)
      // Release so tomorrow's run retries rather than skipping.
      await release(claimId)
    }
  }

  // ── Document requests idle 3+ days ─────────────────────────────────────
  const idleSince = new Date()
  idleSince.setDate(idleSince.getDate() - 3)

  const { data: requests } = await admin
    .from('document_requests')
    .select('id,firm_id,title,token,created_at,expires_at,clients(name,email,phone),document_request_items(label,is_required,fulfilled_document_id)')
    .eq('status', 'open')
    .lte('created_at', idleSince.toISOString())
    .gt('expires_at', new Date().toISOString())

  for (const req of requests ?? []) {
    const outstanding = (req.document_request_items ?? [])
      .filter((item) => item.is_required && item.fulfilled_document_id === null)
      .map((item) => item.label)
    if (outstanding.length === 0) continue

    // Weekly cadence, so a slow client is nudged rather than harassed.
    const week = Math.floor((Date.now() - new Date(req.created_at).getTime()) / (7 * 86_400_000))
    const variant = `nudge-${week}`

    const clientName = req.clients?.name ?? 'Client'
    const firmName = firmNames.get(req.firm_id) ?? 'Your CA'
    const uploadUrl = `${env.appUrl()}/upload/${req.token}`

    const reached = await tryWhatsApp(
      'document_request',
      req.id,
      variant,
      req.firm_id,
      req.clients?.phone,
      () =>
        documentRequestTemplate({
          clientName,
          firmName,
          title: req.title,
          outstanding,
          uploadUrl,
        }),
      `request ${req.id} (${variant})`
    )
    if (reached) continue

    const email = req.clients?.email
    if (!email) {
      skipped.push(`request ${req.id}: client has no email`)
      continue
    }

    const claimId = await claim('email', 'document_request', req.id, variant, req.firm_id, email)
    if (!claimId) {
      skipped.push(`request ${req.id} (${variant}): already sent`)
      continue
    }

    const { subject, html } = documentNudgeEmail({
      clientName,
      firmName,
      title: req.title,
      outstanding,
      uploadUrl,
    })

    const result = await sendEmail({ to: email, subject, html })
    if (result.ok) {
      await markSent(claimId, result.id)
      sent.push(`request ${req.id} (${variant})`)
    } else {
      failed.push(`request ${req.id}: ${result.error}`)
      await release(claimId)
    }
  }

  return NextResponse.json({
    ok: true,
    // Stated explicitly so a run that sent nothing over WhatsApp is
    // distinguishable from one where WhatsApp is simply not live yet.
    whatsapp: whatsapp.enabled ? 'enabled' : `disabled (${whatsapp.reason})`,
    sent: sent.length,
    skipped: skipped.length,
    failed: failed.length,
    detail: { sent, skipped, failed },
  })
}
