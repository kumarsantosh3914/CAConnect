import { generateShareToken, isValidTokenFormat } from '@/lib/tokens'

/**
 * The upload token is the ONLY credential the CA's client holds. It is the
 * shared share-token primitive from lib/tokens.ts — the client portal uses
 * the same one, and they must not diverge.
 */
export const generateUploadToken = generateShareToken

export { isValidTokenFormat }

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
