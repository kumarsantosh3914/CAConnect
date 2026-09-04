import 'server-only'
import { env } from '@/lib/env'
import type { WhatsAppProvider, WhatsAppSendResult } from './provider'

/**
 * Meta WhatsApp Cloud API.
 *
 * The only file in the codebase that knows Meta's wire format. Everything else
 * goes through lib/whatsapp/provider.ts.
 */

/**
 * Errors worth trying again tomorrow, versus errors that will fail forever.
 *
 * This distinction decides whether the reminder cron releases its dedupe claim
 * and retries, so getting it wrong either spams a client daily or drops their
 * reminder silently. Rate limits and Meta's own outages are transient; an
 * unapproved template or a number that is not on WhatsApp will never succeed
 * no matter how often we ask.
 */
const PERMANENT_ERROR_CODES = new Set([
  100, // invalid parameter — our payload is wrong
  131_026, // recipient cannot receive messages (not on WhatsApp)
  131_047, // re-engagement required outside the 24h window
  132_000, // template param count mismatch
  132_001, // template does not exist / not approved
  132_005, // template text was changed and needs re-approval
  132_007, // template format mismatch
  133_010, // phone number not registered
])

function isRetryable(code: number | undefined, httpStatus: number): boolean {
  if (code !== undefined && PERMANENT_ERROR_CODES.has(code)) return false
  // 4xx that we did not recognise is almost certainly our fault and stable.
  if (httpStatus >= 400 && httpStatus < 500 && httpStatus !== 429) return false
  return true
}

export function createMetaProvider(): WhatsAppProvider {
  return {
    name: 'meta-cloud',

    async sendTemplate({ to, template }): Promise<WhatsAppSendResult> {
      const phoneNumberId = env.whatsappPhoneNumberId()
      const accessToken = env.whatsappAccessToken()

      if (!phoneNumberId || !accessToken) {
        return { ok: false, error: 'WhatsApp is not configured.', retryable: false }
      }

      const url = `https://graph.facebook.com/${env.whatsappApiVersion()}/${phoneNumberId}/messages`

      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: template.name,
          language: { code: template.language },
          components: [{ type: 'body', parameters: template.params }],
        },
      }

      let response: Response
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          // A hung request must not take the whole cron run down with it.
          signal: AbortSignal.timeout(15_000),
        })
      } catch (error) {
        return {
          ok: false,
          error: `Could not reach WhatsApp: ${(error as Error).message}`,
          retryable: true,
        }
      }

      let body: {
        messages?: { id: string }[]
        error?: { message?: string; code?: number; error_data?: { details?: string } }
      }
      try {
        body = await response.json()
      } catch {
        return {
          ok: false,
          error: `WhatsApp returned an unreadable response (HTTP ${response.status}).`,
          retryable: response.status >= 500,
        }
      }

      if (!response.ok || body.error) {
        const code = body.error?.code
        // error_data.details is where Meta puts the useful part — "template
        // name does not exist in the translation" and the like.
        const detail = body.error?.error_data?.details ?? body.error?.message ?? 'Unknown error'
        return {
          ok: false,
          error: code ? `[${code}] ${detail}` : detail,
          retryable: isRetryable(code, response.status),
        }
      }

      const messageId = body.messages?.[0]?.id
      if (!messageId) {
        return { ok: false, error: 'WhatsApp accepted the message but returned no id.', retryable: false }
      }

      return { ok: true, messageId }
    },
  }
}
