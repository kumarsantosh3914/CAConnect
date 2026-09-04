import { randomBytes } from 'node:crypto'

/**
 * The upload token is the ONLY credential the CA's client holds. It stands in
 * for a login, so it must be unguessable: 32 bytes of CSPRNG entropy, not a
 * uuid and never a sequential id.
 */
export function generateUploadToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Cheap shape check before touching the database. */
export function isValidTokenFormat(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token)
}

export const UPLOAD_LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxFilesPerRequest: 40,
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/webp',
    'application/pdf',
  ],
} as const

/**
 * Strips directory traversal and anything that would confuse storage paths.
 * The stored path is generated server-side regardless — this only keeps the
 * display name sane.
 */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file'
  const cleaned = base.replace(/[^\w.\- ]+/g, '_').replace(/_{2,}/g, '_').trim()
  return (cleaned || 'file').slice(0, 120)
}
