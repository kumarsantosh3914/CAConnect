import { randomBytes } from 'node:crypto'

/**
 * Share tokens — the credential behind every link CAConnect sends to someone
 * who has no account: document upload requests and client portals.
 *
 * A share token stands in for a login, so it must be unguessable: 32 bytes of
 * CSPRNG entropy, not a uuid (only ~122 bits, and v4 layout is partly fixed)
 * and never a sequential id. 256 bits is far past the point where guessing is
 * the attack anyone would choose.
 *
 * One implementation for both surfaces on purpose. Two token generators drift,
 * and the weaker one becomes the way in.
 */
export function generateShareToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Cheap shape check before touching the database. 32 bytes of base64url is
 * always exactly 43 characters, so anything else is not a token we issued and
 * does not deserve a query.
 */
export function isValidTokenFormat(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token)
}
