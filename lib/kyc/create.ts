import 'server-only'

import { generateUploadToken } from '@/lib/documents/tokens'
import { KYC_CHECKLISTS, type KycEntityType } from './checklists'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export async function createKycRequest(
  supabase: SupabaseClient<Database>,
  input: { firmId: string; userId: string; clientId: string; entityType: KycEntityType }
): Promise<{ id: string; token: string } | null> {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)
  const { data: request, error } = await supabase.from('document_requests').insert({
    firm_id: input.firmId, created_by: input.userId, client_id: input.clientId,
    token: generateUploadToken(), title: 'KYC documents',
    message: 'Please upload the documents below so we can complete your onboarding.',
    expires_at: expiresAt.toISOString(), request_kind: 'kyc',
  }).select('id,token').single()
  if (error || !request) return null
  const { error: itemError } = await supabase.from('document_request_items').insert(
    KYC_CHECKLISTS[input.entityType].map((item, sort_order) => ({
      firm_id: input.firmId, created_by: input.userId, request_id: request.id,
      label: item.label, is_required: item.isRequired, sort_order,
    }))
  )
  if (itemError) { await supabase.from('document_requests').delete().eq('id', request.id); return null }
  return request
}
