import { describe, expect, it } from 'vitest'
import { normalizeIndianMobile } from './phone'

/**
 * A wrong number here does not fail loudly — it delivers a client's private
 * upload link to a stranger. Every accepted input is checked against the exact
 * digits we would hand to Meta.
 */
describe('normalizeIndianMobile', () => {
  it('accepts the ways a CA actually types an Indian mobile', () => {
    const expected = '919876543210'
    for (const input of [
      '9876543210',
      '98765 43210',
      '98765-43210',
      '+919876543210',
      '+91 98765 43210',
      '+91-98765-43210',
      '91 9876543210',
      '09876543210',
      '0091 9876543210',
      '00919876543210',
      ' 9876543210 ',
      '(98765) 43210',
    ]) {
      expect(normalizeIndianMobile(input), input).toBe(expected)
    }
  })

  it('rejects anything that is not a real Indian mobile', () => {
    // Indian mobiles start 6-9. A landline or a typo must not be "fixed" into
    // someone else's number.
    expect(normalizeIndianMobile('1234567890')).toBeNull()
    expect(normalizeIndianMobile('5876543210')).toBeNull()
    expect(normalizeIndianMobile('911234567890')).toBeNull()
    expect(normalizeIndianMobile('98765')).toBeNull()
    expect(normalizeIndianMobile('abcd')).toBeNull()
    expect(normalizeIndianMobile('')).toBeNull()
    expect(normalizeIndianMobile(null)).toBeNull()
    expect(normalizeIndianMobile(undefined)).toBeNull()
  })

  it('leaves a foreign number alone rather than forcing +91 onto it', () => {
    // An NRI client with a UK or UAE number must still be reachable.
    expect(normalizeIndianMobile('+44 20 7946 0958')).toBe('442079460958')
    expect(normalizeIndianMobile('+971 50 123 4567')).toBe('971501234567')
  })

  it('never returns a plus, which Meta rejects', () => {
    expect(normalizeIndianMobile('+919876543210')).not.toContain('+')
  })

  it('refuses absurd lengths instead of truncating them', () => {
    expect(normalizeIndianMobile('9'.repeat(20))).toBeNull()
    expect(normalizeIndianMobile('1234567')).toBeNull()
  })
})
