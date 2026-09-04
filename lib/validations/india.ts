/**
 * Indian tax identifier validation.
 *
 * PAN: 5 letters, 4 digits, 1 letter. The 4th character encodes holder type
 * (P individual, C company, H HUF, F firm, A AOP, T trust, ...).
 *
 * GSTIN: 15 chars — 2-digit state code, 10-char PAN, 1 entity number,
 * 'Z', then a base-36 check digit.
 */

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

const GSTIN_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * Verifies the GSTIN check digit. Format-valid GSTINs can still fail this.
 *
 * Deliberately advisory, not blocking: CAs type these off paper and a wrong
 * digit should warn, not throw the whole record away. Callers surface it as a
 * warning next to the field.
 */
export function isGstinChecksumValid(gstin: string): boolean {
  if (!GSTIN_REGEX.test(gstin)) return false

  let sum = 0
  for (let i = 0; i < 14; i++) {
    const value = GSTIN_ALPHABET.indexOf(gstin[i])
    if (value === -1) return false
    const factor = i % 2 === 0 ? 1 : 2
    const product = value * factor
    sum += Math.floor(product / 36) + (product % 36)
  }

  const expected = GSTIN_ALPHABET[(36 - (sum % 36)) % 36]
  return expected === gstin[14]
}

/** The PAN embedded in a GSTIN, for cross-checking against the client's PAN. */
export function panFromGstin(gstin: string): string | null {
  return GSTIN_REGEX.test(gstin) ? gstin.slice(2, 12) : null
}

const STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
  '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
  '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep',
  '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands', '36': 'Telangana',
  '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory',
}

export function stateFromGstin(gstin: string): string | null {
  return STATE_CODES[gstin.slice(0, 2)] ?? null
}
