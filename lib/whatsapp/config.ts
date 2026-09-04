import { env } from '@/lib/env'

/**
 * Whether CAConnect may send WhatsApp messages right now.
 *
 * This is a feature flag, not a config lookup, and it defaults to OFF for a
 * reason: the Meta WhatsApp Business API cannot be used until Meta has
 * verified the business AND approved each message template. Until that clears,
 * every send would fail — and worse, a half-configured deploy that started
 * messaging real clients on a CA's behalf would be a trust incident, not a bug.
 *
 * So two independent things must be true: credentials present, and someone
 * having explicitly set WHATSAPP_ENABLED=true. Credentials alone are never
 * enough.
 *
 * The reason string exists so the reminder cron can report "whatsapp: awaiting
 * Meta approval" instead of silently doing nothing, which is indistinguishable
 * from being broken.
 */
export type WhatsAppStatus =
  | { enabled: true }
  | { enabled: false; reason: string }

export function whatsappStatus(): WhatsAppStatus {
  if (!env.whatsappEnabledFlag()) {
    return { enabled: false, reason: 'WHATSAPP_ENABLED is not set to true' }
  }

  const missing = [
    ['WHATSAPP_PHONE_NUMBER_ID', env.whatsappPhoneNumberId()],
    ['WHATSAPP_ACCESS_TOKEN', env.whatsappAccessToken()],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name)

  if (missing.length > 0) {
    return { enabled: false, reason: `missing ${missing.join(', ')}` }
  }

  return { enabled: true }
}

export function whatsappEnabled(): boolean {
  return whatsappStatus().enabled
}

/**
 * Webhooks are verified independently of the send path. Meta will call the
 * callback URL to confirm it during setup — before sending is switched on —
 * so this must work while whatsappEnabled() is still false.
 */
export function whatsappWebhookConfigured(): boolean {
  return Boolean(env.whatsappVerifyToken() && env.whatsappAppSecret())
}
