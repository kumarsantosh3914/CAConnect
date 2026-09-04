import { afterEach, describe, expect, it } from 'vitest'
import { whatsappStatus, whatsappWebhookConfigured } from './config'

/**
 * This flag is what stands between a half-configured deploy and CAConnect
 * messaging real clients on a CA's behalf before Meta has approved anything.
 * It must fail closed in every direction.
 */
const KEYS = [
  'WHATSAPP_ENABLED',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_VERIFY_TOKEN',
  'WHATSAPP_APP_SECRET',
] as const

function clear() {
  for (const key of KEYS) delete process.env[key]
}

afterEach(clear)

describe('whatsappStatus', () => {
  it('is off when nothing is set', () => {
    clear()
    expect(whatsappStatus()).toEqual({
      enabled: false,
      reason: 'WHATSAPP_ENABLED is not set to true',
    })
  })

  it('stays off when credentials exist but nobody switched it on', () => {
    clear()
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123'
    process.env.WHATSAPP_ACCESS_TOKEN = 'tok'
    expect(whatsappStatus().enabled).toBe(false)
  })

  it('stays off when switched on but not configured, and says what is missing', () => {
    clear()
    process.env.WHATSAPP_ENABLED = 'true'
    const status = whatsappStatus()
    expect(status.enabled).toBe(false)
    if (!status.enabled) {
      expect(status.reason).toContain('WHATSAPP_PHONE_NUMBER_ID')
      expect(status.reason).toContain('WHATSAPP_ACCESS_TOKEN')
    }
  })

  it('does not treat a truthy-looking string as consent', () => {
    clear()
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123'
    process.env.WHATSAPP_ACCESS_TOKEN = 'tok'
    for (const value of ['1', 'yes', 'TRUE', 'on', '']) {
      process.env.WHATSAPP_ENABLED = value
      expect(whatsappStatus().enabled, value).toBe(false)
    }
  })

  it('turns on only with the flag and both credentials', () => {
    clear()
    process.env.WHATSAPP_ENABLED = 'true'
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123'
    process.env.WHATSAPP_ACCESS_TOKEN = 'tok'
    expect(whatsappStatus()).toEqual({ enabled: true })
  })
})

describe('whatsappWebhookConfigured', () => {
  it('is independent of the send flag, because Meta verifies the URL first', () => {
    clear()
    process.env.WHATSAPP_VERIFY_TOKEN = 'v'
    process.env.WHATSAPP_APP_SECRET = 's'
    expect(whatsappWebhookConfigured()).toBe(true)
    expect(whatsappStatus().enabled).toBe(false)
  })

  it('needs both halves', () => {
    clear()
    process.env.WHATSAPP_VERIFY_TOKEN = 'v'
    expect(whatsappWebhookConfigured()).toBe(false)
  })
})
