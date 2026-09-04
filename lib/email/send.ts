import 'server-only'
import { Resend } from 'resend'
import { env } from '@/lib/env'

/**
 * Transactional email.
 *
 * Templates are plain HTML strings rather than a component library — the two
 * emails V1 sends are simple, and a rendering dependency would be more moving
 * parts than the feature is worth.
 */

export type SendResult = { ok: true; id: string } | { ok: false; error: string }

export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
}: {
  to: string
  subject: string
  html: string
  replyTo?: string
}): Promise<SendResult> {
  let resend: Resend
  try {
    resend = new Resend(env.resendApiKey())
  } catch {
    return { ok: false, error: 'Email is not configured (RESEND_API_KEY missing).' }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: env.resendFrom(),
      to,
      subject,
      html,
      replyTo,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true, id: data?.id ?? 'unknown' }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}
