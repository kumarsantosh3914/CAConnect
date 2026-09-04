'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getApiFirm } from '@/lib/auth'
import { generateUploadToken } from '@/lib/documents/tokens'
import { requestOrigin } from '@/lib/url'

export type TeamActionResult = { ok: true } | { ok: false; error: string }
export type InviteResult = { ok: true; url: string } | { ok: false; error: string }

const inviteSchema = z.object({
  email: z.email('Enter a valid email address'),
  role: z.enum(['owner', 'staff']),
})

const INVITE_VALID_DAYS = 14

/**
 * Creates an invite and returns its link.
 *
 * The link is returned rather than emailed: Resend cannot yet send to
 * arbitrary recipients on this account, and an invite the owner believes was
 * sent but which silently never arrived is worse than one they copy and send
 * themselves. Same reasoning as the client document upload links.
 */
export async function inviteMember(input: z.infer<typeof inviteSchema>): Promise<InviteResult> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }
  const { user, firm } = ctx

  if (firm.role !== 'owner') {
    return { ok: false, error: 'Only the firm owner can invite people.' }
  }

  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form.' }
  }

  const email = parsed.data.email.trim().toLowerCase()

  // A second owner would violate the one-owner-per-firm index at the moment
  // they accept, which is a confusing place to discover it.
  if (parsed.data.role === 'owner') {
    return { ok: false, error: 'A firm has one owner. Invite them as staff instead.' }
  }

  const supabase = await createClient()

  const { data: existingMembers } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
  if (existingMembers?.length) {
    const { data: already } = await supabase
      .from('firm_members')
      .select('id')
      .eq('firm_id', firm.firmId)
      .in('user_id', existingMembers.map((m) => m.id))
    if (already?.length) {
      return { ok: false, error: 'That person is already in your firm.' }
    }
  }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + INVITE_VALID_DAYS)
  const token = generateUploadToken()

  const { error } = await supabase.from('firm_invites').insert({
    firm_id: firm.firmId,
    email,
    role: parsed.data.role,
    token,
    invited_by: user.id,
    expires_at: expiresAt.toISOString(),
  })

  if (error) {
    // The partial unique index on (firm_id, lower(email)) where not accepted.
    if (error.code === '23505') {
      return { ok: false, error: 'There is already a pending invite for that email.' }
    }
    return { ok: false, error: 'Could not create that invite. Please try again.' }
  }

  revalidatePath('/team')
  return { ok: true, url: `${await requestOrigin()}/invite/${token}` }
}

export async function revokeInvite(inviteId: string): Promise<TeamActionResult> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }
  if (ctx.firm.role !== 'owner') {
    return { ok: false, error: 'Only the firm owner can revoke invites.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('firm_invites').delete().eq('id', inviteId)
  if (error) return { ok: false, error: 'Could not revoke that invite.' }

  revalidatePath('/team')
  return { ok: true }
}

/**
 * Removes a member from the firm. Their work stays with the firm — domain rows
 * are keyed to firm_id — but anything assigned to them is handed back so it
 * does not vanish from every assignee filter.
 */
export async function removeMember(userId: string): Promise<TeamActionResult> {
  const ctx = await getApiFirm()
  if (!ctx) return { ok: false, error: 'Your session has expired. Please log in again.' }
  const { user, firm } = ctx

  if (firm.role !== 'owner') {
    return { ok: false, error: 'Only the firm owner can remove people.' }
  }
  if (userId === user.id) {
    return { ok: false, error: 'You cannot remove yourself. A firm needs an owner.' }
  }

  const supabase = await createClient()

  // Hand their work back to the firm first. assigned_to references auth.users,
  // not firm_members, so removing the membership would otherwise leave filings
  // assigned to somebody who is no longer here — invisible in every filter.
  await supabase
    .from('deadlines')
    .update({ assigned_to: null })
    .eq('firm_id', firm.firmId)
    .eq('assigned_to', userId)
  await supabase
    .from('clients')
    .update({ assigned_to: null })
    .eq('firm_id', firm.firmId)
    .eq('assigned_to', userId)

  const { error } = await supabase
    .from('firm_members')
    .delete()
    .eq('firm_id', firm.firmId)
    .eq('user_id', userId)

  if (error) return { ok: false, error: 'Could not remove that person.' }

  revalidatePath('/team')
  return { ok: true }
}

/** Joins the signed-in user to a firm via an invite token. */
export async function acceptInvite(token: string): Promise<TeamActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please log in to accept this invitation.' }

  // The database function does the whole join in one transaction: it checks
  // the token, matches the invite's email against the caller's, inserts the
  // membership and marks the invite used. None of that is possible under RLS
  // from here, because an invitee is not yet a member of anything.
  const { error } = await supabase.rpc('accept_firm_invite', { invite_token: token })

  if (error) {
    if (error.message.includes('different email')) {
      return { ok: false, error: 'This invitation was sent to a different email address.' }
    }
    if (error.message.includes('not valid')) {
      return { ok: false, error: 'This invitation has expired or has already been used.' }
    }
    return { ok: false, error: 'Could not accept that invitation.' }
  }

  revalidatePath('/dashboard')
  revalidatePath('/team')
  return { ok: true }
}
