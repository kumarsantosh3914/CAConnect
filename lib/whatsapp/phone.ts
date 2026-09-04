/**
 * Phone numbers, normalised to what the WhatsApp API expects.
 *
 * Meta wants a number in international format with no punctuation and no
 * leading '+' or '00'. CAs type Indian numbers every way a human can:
 * "98765 43210", "+91 98765-43210", "091-9876543210", "0 9876543210".
 *
 * The India default is deliberate and narrow. A bare 10-digit number is
 * assumed to be Indian because that is who this product serves, and Indian
 * mobiles are exactly 10 digits starting 6-9. Anything already carrying a
 * country code is left alone, so a CA with an NRI client is not broken by the
 * assumption.
 *
 * Getting this wrong sends a client's document link to a stranger, so the
 * function refuses rather than guesses whenever the shape is not one it knows.
 */

const INDIA_CC = '91'

export function normalizeIndianMobile(raw: string | null | undefined): string | null {
  if (!raw) return null

  let digits = raw.replace(/\D/g, '')
  if (!digits) return null

  // "00" is the international access prefix in much of the world; strip it so
  // 0091... is not mistaken for a domestic trunk call.
  if (digits.startsWith('00')) digits = digits.slice(2)

  // A domestic trunk prefix: 0 98765 43210.
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)

  // Already Indian and fully qualified.
  if (digits.length === 12 && digits.startsWith(INDIA_CC)) {
    return isIndianMobile(digits.slice(2)) ? digits : null
  }

  // Bare Indian mobile.
  if (digits.length === 10) {
    return isIndianMobile(digits) ? INDIA_CC + digits : null
  }

  // Some other country, already qualified. We cannot validate the national
  // part, but a plausible E.164 length is 8–15 digits including the code.
  if (digits.length >= 8 && digits.length <= 15) return digits

  return null
}

/** Indian mobile numbers are 10 digits and start 6, 7, 8 or 9. */
function isIndianMobile(tenDigits: string): boolean {
  return /^[6-9]\d{9}$/.test(tenDigits)
}

/** For display and for wa.me links, which want the same bare digits. */
export function toWaMeNumber(raw: string | null | undefined): string | null {
  return normalizeIndianMobile(raw)
}
