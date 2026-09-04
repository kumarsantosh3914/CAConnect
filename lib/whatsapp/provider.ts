import 'server-only'
import type { WhatsAppTemplate } from './templates'

/**
 * The WhatsApp seam, in the same spirit as lib/ai/provider.ts.
 *
 * Meta's Cloud API is the implementation today, but in India the common path
 * is a BSP (Gupshup, AiSensy, Interakt) rather than Meta direct — they handle
 * the business verification that is currently blocking us. Every one of them
 * speaks "send this approved template, to this number, with these
 * parameters", so that is the whole interface. Swapping providers should mean
 * adding one file and changing one env var, with no call site touched.
 */

export type WhatsAppSendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; retryable: boolean }

export type WhatsAppProvider = {
  readonly name: string
  sendTemplate(input: {
    /** Digits only, country code included, no '+'. See lib/whatsapp/phone.ts. */
    to: string
    template: WhatsAppTemplate
  }): Promise<WhatsAppSendResult>
}
