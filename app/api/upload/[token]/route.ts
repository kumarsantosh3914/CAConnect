import { NextResponse, type NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  UPLOAD_LIMITS,
  isValidTokenFormat,
  sanitizeFileName,
} from '@/lib/documents/tokens'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE SECURITY BOUNDARY OF V1. Read this before changing anything below.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every other table in CAConnect is guarded by RLS: `user_id = auth.uid()`.
 * This route cannot be, because the whole point of document collection is
 * that the CA's client uploads WITHOUT an account. An anonymous browser has
 * no auth.uid() to check.
 *
 * So authorisation here is a 32-byte CSPRNG token, and this route is the only
 * place in the codebase (with lib/documents/public.ts) that uses the
 * service-role key. That key never reaches the browser.
 *
 * Rules this route enforces, in order:
 *   1. Token must be well-formed, exist, be unexpired and still open.
 *   2. Rate limited per token and per IP.
 *   3. File must pass size and MIME checks BEFORE it reaches storage.
 *   4. The request may not exceed a hard file cap.
 *   5. item_id, if supplied, must belong to THIS request — never trusted.
 *   6. user_id and client_id come from the looked-up request, never from
 *      the submitted form. A caller cannot write into another CA's tenant.
 *   7. The storage path is generated server-side, under the owning CA's
 *      user_id prefix.
 *
 * Do not add a second service-role call site. If RLS is blocking you
 * elsewhere, the policy or the query is wrong.
 */

export const runtime = 'nodejs'

// Best-effort throttle. Serverless means several instances, so this narrows
// abuse rather than eliminating it; the durable guards are token expiry and
// the per-request file cap above.
// Per-token is the tighter limit: one client working through a checklist.
// Per-IP is looser, because a shared office or NAT can legitimately carry
// several clients of the same firm.
const RATE_LIMITS = { token: 30, ip: 60 }
const WINDOW_MS = 60_000
const attempts = new Map<string, { count: number; resetAt: number }>()

function rateLimited(key: string, max: number): boolean {
  const now = Date.now()
  const entry = attempts.get(key)

  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    if (attempts.size > 5000) {
      for (const [k, v] of attempts) if (v.resetAt < now) attempts.delete(k)
    }
    return false
  }

  entry.count += 1
  return entry.count > max
}

/** Human-readable, and deliberately vague about why a token failed. */
function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: NextRequest, context: RouteContext<'/api/upload/[token]'>) {
  const { token } = await context.params

  if (!isValidTokenFormat(token)) {
    return fail('This upload link is not valid.', 404)
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (rateLimited(`t:${token}`, RATE_LIMITS.token) || rateLimited(`ip:${ip}`, RATE_LIMITS.ip)) {
    return fail('Too many uploads just now. Please wait a minute and try again.', 429)
  }

  // Reject on the declared size BEFORE parsing the body. Without this an
  // oversized upload is buffered in full only for formData() to blow up, and
  // the client sees "could not be read" instead of the real reason.
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (declaredLength > UPLOAD_LIMITS.maxFileBytes + 1024 * 64) {
    return fail('That file is larger than 10 MB. Please compress it and try again.', 413)
  }

  const admin = createAdminClient()

  const { data: uploadRequest, error: lookupError } = await admin
    .from('document_requests')
    .select('id,user_id,client_id,status,expires_at')
    .eq('token', token)
    .maybeSingle()

  if (lookupError || !uploadRequest) {
    return fail('This upload link is not valid.', 404)
  }
  if (new Date(uploadRequest.expires_at) < new Date()) {
    return fail('This upload link has expired. Please ask your CA for a new one.', 410)
  }
  if (uploadRequest.status === 'expired') {
    return fail('This upload link is no longer active.', 410)
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    // Body larger than the platform's parse limit lands here too, so name the
    // most likely cause rather than something the client cannot act on.
    return fail('That file could not be read. It may be too large — the limit is 10 MB.', 413)
  }

  const file = form.get('file')
  const rawItemId = form.get('item_id')

  if (!(file instanceof File)) {
    return fail('No file was received.', 400)
  }
  if (file.size === 0) {
    return fail('That file is empty.', 400)
  }
  if (file.size > UPLOAD_LIMITS.maxFileBytes) {
    return fail('That file is larger than 10 MB. Please compress it and try again.', 413)
  }
  if (!UPLOAD_LIMITS.allowedMimeTypes.includes(file.type as never)) {
    return fail('Please upload a PDF or a photo (JPG, PNG or HEIC).', 415)
  }

  // Hard cap per request, enforced in the database rather than in memory.
  const { count: existingCount } = await admin
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('request_id', uploadRequest.id)

  if ((existingCount ?? 0) >= UPLOAD_LIMITS.maxFilesPerRequest) {
    return fail('This request already has the maximum number of files.', 409)
  }

  // An item_id from the form is untrusted: confirm it belongs to THIS request.
  let itemId: string | null = null
  if (typeof rawItemId === 'string' && rawItemId) {
    const { data: item } = await admin
      .from('document_request_items')
      .select('id')
      .eq('id', rawItemId)
      .eq('request_id', uploadRequest.id)
      .maybeSingle()
    if (!item) return fail('That checklist item does not belong to this request.', 400)
    itemId = item.id
  }

  // Path is built server-side from the OWNING CA's id, never from the form,
  // so an upload cannot land in another tenant's prefix.
  const fileName = sanitizeFileName(file.name)
  const storagePath = `${uploadRequest.user_id}/${uploadRequest.client_id}/${randomUUID()}-${fileName}`

  const { error: storageError } = await admin.storage
    .from('client-documents')
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  if (storageError) {
    console.error('Upload failed for request', uploadRequest.id, storageError)
    return fail('We could not save that file. Please try again.', 500)
  }

  const { data: document, error: insertError } = await admin
    .from('documents')
    .insert({
      user_id: uploadRequest.user_id,
      client_id: uploadRequest.client_id,
      request_id: uploadRequest.id,
      item_id: itemId,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: 'client',
    })
    .select('id')
    .single()

  if (insertError || !document) {
    // Don't leave an orphaned object behind if the row failed.
    await admin.storage.from('client-documents').remove([storagePath])
    console.error('Document row failed for request', uploadRequest.id, insertError)
    return fail('We could not save that file. Please try again.', 500)
  }

  if (itemId) {
    await admin
      .from('document_request_items')
      .update({ fulfilled_document_id: document.id })
      .eq('id', itemId)
      .eq('request_id', uploadRequest.id)
  }

  // Mark the request complete once every required item has a file, so the CA
  // sees at a glance that they can stop chasing.
  const { data: remaining } = await admin
    .from('document_request_items')
    .select('id')
    .eq('request_id', uploadRequest.id)
    .eq('is_required', true)
    .is('fulfilled_document_id', null)

  const isComplete = (remaining?.length ?? 0) === 0
  if (isComplete && uploadRequest.status !== 'completed') {
    await admin
      .from('document_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', uploadRequest.id)
  }

  return NextResponse.json({
    ok: true,
    documentId: document.id,
    fileName,
    complete: isComplete,
  })
}
