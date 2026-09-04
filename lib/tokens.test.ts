import { describe, expect, it } from 'vitest'
import { generateShareToken, isValidTokenFormat } from './tokens'

/**
 * These two functions are the credential behind every link CAConnect sends to
 * someone with no account — document uploads and client portals both. A
 * regression here is an authorisation regression, not a formatting one.
 */
describe('generateShareToken', () => {
  it('is 43 base64url characters, which is exactly 32 bytes', () => {
    for (let i = 0; i < 50; i += 1) {
      const token = generateShareToken()
      expect(token).toHaveLength(43)
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  it('never pads, so the format check never has to allow "="', () => {
    expect(generateShareToken()).not.toContain('=')
  })

  it('does not repeat', () => {
    const tokens = new Set(Array.from({ length: 500 }, generateShareToken))
    expect(tokens.size).toBe(500)
  })

  it('produces tokens its own validator accepts', () => {
    expect(isValidTokenFormat(generateShareToken())).toBe(true)
  })
})

describe('isValidTokenFormat', () => {
  it('rejects anything that is not exactly 43 characters', () => {
    expect(isValidTokenFormat('')).toBe(false)
    expect(isValidTokenFormat('short')).toBe(false)
    expect(isValidTokenFormat('a'.repeat(42))).toBe(false)
    expect(isValidTokenFormat('a'.repeat(44))).toBe(false)
  })

  it('rejects characters outside base64url, including the ones that matter', () => {
    // Each of these is a real attempt shape: SQL, path traversal, padded
    // base64, and a URL-encoded separator.
    expect(isValidTokenFormat("' OR 1=1--".padEnd(43, 'a'))).toBe(false)
    expect(isValidTokenFormat('../'.repeat(14) + 'a')).toBe(false)
    expect(isValidTokenFormat('a'.repeat(42) + '=')).toBe(false)
    expect(isValidTokenFormat('a'.repeat(42) + '%')).toBe(false)
    expect(isValidTokenFormat('a'.repeat(42) + '/')).toBe(false)
    expect(isValidTokenFormat('a'.repeat(42) + '+')).toBe(false)
  })

  it('rejects a token with whitespace, including a trailing newline', () => {
    expect(isValidTokenFormat(`${'a'.repeat(43)}\n`)).toBe(false)
    expect(isValidTokenFormat(` ${'a'.repeat(42)}`)).toBe(false)
  })

  it('accepts the full base64url alphabet', () => {
    expect(isValidTokenFormat(`${'-_'.repeat(20)}abc`)).toBe(true)
  })
})
