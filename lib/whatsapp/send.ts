import 'server-only'
import { whatsappStatus } from './config'
import { createMetaProvider } from './meta'
import { normalizeIndianMobile } from './phone'
import type { WhatsAppSendResult } from './provider'
import type { WhatsAppTemplate } from './templates'

/**
 * The one entry point the rest of the app uses to send a WhatsApp message.
 *
 * It refuses before doing anything if the feature is switched off, so callers
 * do not each have to remember the flag. `skipped` is a distinct outcome from
 * `failed` on purpose: "we are waiting on Meta" and "the send broke" look the
 * same to a caller that only checks ok/not-ok, and the reminder cron must
 * treat them very differently — a skip is normal, a failure needs a retry.
 */

export type WhatsAppOutcome =
  | { status: 'sent'; messageId: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string; retryable: boolean }

let cachedProvider: ReturnType<typeof createMetaProvider> | null = null

function provider() {
  cachedProvider ??= createMetaProvider()
  return cachedProvider
}

export async function sendWhatsAppTemplate(input: {
  to: string | null | undefined
  template: WhatsAppTemplate
}): Promise<WhatsAppOutcome> {
  const status = whatsappStatus()
  if (!status.enabled) {
    return { status: 'skipped', reason: status.reason }
  }

  const to = normalizeIndianMobile(input.to)
  if (!to) {
    // Not a failure to retry: the number will still be unusable tomorrow.
    return { status: 'skipped', reason: 'no usable phone number' }
  }

  const result: WhatsAppSendResult = await provider().sendTemplate({ to, template: input.template })

  if (result.ok) return { status: 'sent', messageId: result.messageId }
  return { status: 'failed', error: result.error, retryable: result.retryable }
}
