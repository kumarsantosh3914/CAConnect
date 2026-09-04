import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidTokenFormat } from '@/lib/tokens'
import type { DeadlineStatus, FeeStatus, ServiceType } from '@/types/database'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ANONYMOUS SURFACE. Authorisation here is a token, not RLS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The client portal shows a CA's client their own filing status without an
 * account, so there is no auth.uid() and the `firm_id in (select
 * auth_firm_ids())` policy on every table can never be satisfied. This module
 * therefore uses the service-role client, exactly as lib/documents/public.ts
 * does for upload links, and the 32-byte token IS the credential.
 *
 * Two rules keep that safe, and both are load-bearing:
 *
 *   1. EVERY query below is filtered by `client_id` taken from the looked-up
 *      portal row — never from anything the visitor supplied. A caller cannot
 *      steer these queries at another client, or another firm.
 *
 *   2. What is returned is an allow-list, not a `select *` minus a few
 *      columns. A column added to `fees` or `deadlines` later does not
 *      silently start appearing on a client-facing page.
 *
 * WHAT THE PORTAL DELIBERATELY DOES NOT SHOW, and why:
 *
 *   - Draft fees. `draft` is the CA's own working state — a figure they are
 *     still deciding. Showing it to the client turns thinking out loud into a
 *     quote. Only `invoiced` and `paid` cross the boundary.
 *   - Notices and their AI drafts. That is CA work product, and an
 *     unreviewed AI draft in a client's hands is actively harmful.
 *   - Client emails, internal notes, PAN and GSTIN.
 *   - Which staff member is assigned. The client engaged the firm, not a
 *     junior, and staffing is the firm's business.
 *
 * Do not widen this without deciding, deliberately, that a client should see
 * the thing on the day their portal link leaks.
 */

export type PortalDeadline = {
  id: string
  label: string
  service_type: ServiceType
  period_label: string
  due_date: string
  status: DeadlineStatus
  filed_at: string | null
}

export type PortalDocumentRequest = {
  id: string
  token: string
  title: string
  message: string | null
  expires_at: string
  total: number
  fulfilled: number
}

export type PortalDocument = {
  id: string
  file_name: string
  mime_type: string
  size_bytes: number
  created_at: string
  uploaded_by: 'ca' | 'client'
}

export type PortalFee = {
  id: string
  description: string
  service_type: ServiceType | null
  amount_paise: number
  status: Extract<FeeStatus, 'invoiced' | 'paid'>
  due_date: string | null
  paid_at: string | null
}

export type PortalView = {
  client_name: string
  firm_name: string | null
  firm_city: string | null
  deadlines: PortalDeadline[]
  requests: PortalDocumentRequest[]
  documents: PortalDocument[]
  fees: PortalFee[]
}

export type PortalLookup = { ok: true; portal: PortalView } | { ok: false; reason: 'not_found' }

/**
 * How far back the portal looks. A client cares about what is coming and what
 * was recently filed; a two-year archive is noise on a phone.
 */
const HISTORY_DAYS = 120

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/**
 * Resolves a portal token into everything the public page renders.
 *
 * A revoked portal, a deleted client and a token that never existed all
 * return the same `not_found`. Distinguishing them would tell a stranger
 * holding a guessed token whether they had guessed a real one.
 */
export async function lookupPortal(token: string): Promise<PortalLookup> {
  if (!isValidTokenFormat(token)) return { ok: false, reason: 'not_found' }

  const admin = createAdminClient()

  const { data: portal, error } = await admin
    .from('client_portals')
    .select('id,firm_id,client_id,is_active,clients(name,archived_at)')
    .eq('token', token)
    .maybeSingle()

  if (error || !portal || !portal.is_active || !portal.clients) {
    return { ok: false, reason: 'not_found' }
  }
  // An archived client is one the CA has closed out. Their link stops working
  // rather than showing a frozen page they might act on.
  if (portal.clients.archived_at) return { ok: false, reason: 'not_found' }

  const since = isoDaysAgo(HISTORY_DAYS)

  const [firmResult, deadlineResult, requestResult, documentResult, feeResult] = await Promise.all([
    admin.from('firms').select('name,city').eq('id', portal.firm_id).maybeSingle(),
    admin
      .from('deadlines')
      .select('id,label,service_type,period_label,due_date,status,filed_at')
      .eq('client_id', portal.client_id)
      .gte('due_date', since)
      .order('due_date', { ascending: true })
      .limit(60),
    admin
      .from('document_requests')
      .select('id,token,title,message,expires_at,document_request_items(id,fulfilled_document_id)')
      .eq('client_id', portal.client_id)
      .eq('status', 'open')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('documents')
      .select('id,file_name,mime_type,size_bytes,created_at,uploaded_by')
      .eq('client_id', portal.client_id)
      .order('created_at', { ascending: false })
      .limit(50),
    admin
      .from('fees')
      .select('id,description,service_type,amount_paise,status,due_date,paid_at')
      .eq('client_id', portal.client_id)
      // Never 'draft' — see the header.
      .in('status', ['invoiced', 'paid'])
      .order('created_at', { ascending: false })
      .limit(50),
    // Recording the view rides along with the reads rather than trailing them.
    //
    // It must be IN this Promise.all, not fired off beside it: a supabase-js
    // builder is a thenable that only issues its request when awaited, so
    // `void admin.rpc(...)` builds a query and sends nothing. The counter read
    // "Not opened yet" forever, which is exactly the question the CA is asking
    // the feature to answer. Here it costs no extra latency and actually runs.
    admin.rpc('touch_client_portal', { portal_id: portal.id }),
  ])

  const requests: PortalDocumentRequest[] = (requestResult.data ?? []).map((request) => {
    const items = request.document_request_items ?? []
    return {
      id: request.id,
      token: request.token,
      title: request.title,
      message: request.message,
      expires_at: request.expires_at,
      total: items.length,
      fulfilled: items.filter((item) => item.fulfilled_document_id !== null).length,
    }
  })

  return {
    ok: true,
    portal: {
      client_name: portal.clients.name,
      firm_name: firmResult.data?.name ?? null,
      firm_city: firmResult.data?.city ?? null,
      deadlines: deadlineResult.data ?? [],
      requests,
      documents: documentResult.data ?? [],
      fees: (feeResult.data ?? []) as PortalFee[],
    },
  }
}

/**
 * Resolves a portal token to the one document it is allowed to hand back.
 *
 * The document id comes from the URL, so it is untrusted: this re-checks that
 * the document belongs to THIS portal's client before signing anything. Without
 * that check a valid portal token would become a read primitive over every
 * document in the database.
 */
export async function lookupPortalDocument(
  token: string,
  documentId: string
): Promise<{ ok: true; path: string; fileName: string } | { ok: false }> {
  if (!isValidTokenFormat(token)) return { ok: false }

  const admin = createAdminClient()

  const { data: portal } = await admin
    .from('client_portals')
    .select('client_id,is_active')
    .eq('token', token)
    .maybeSingle()

  if (!portal || !portal.is_active) return { ok: false }

  const { data: document } = await admin
    .from('documents')
    .select('storage_path,file_name')
    .eq('id', documentId)
    .eq('client_id', portal.client_id)
    .maybeSingle()

  if (!document) return { ok: false }
  return { ok: true, path: document.storage_path, fileName: document.file_name }
}
