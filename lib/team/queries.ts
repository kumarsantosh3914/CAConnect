import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { FirmRole } from '@/types/database'

export type TeamMember = {
  userId: string
  email: string | null
  fullName: string | null
  role: FirmRole
  joinedAt: string
}

export type PendingInvite = {
  id: string
  email: string
  role: FirmRole
  token: string
  expiresAt: string
  createdAt: string
}

/**
 * Members of the caller's firm. RLS scopes both the membership rows and the
 * profiles (profiles_select_colleagues).
 *
 * Two queries rather than an embedded join: firm_members.user_id and
 * profiles.id both reference auth.users, with no foreign key directly between
 * them, so PostgREST cannot embed one in the other. A firm has a handful of
 * people, so merging in JS costs nothing.
 */
export async function listTeamMembers(firmId: string): Promise<TeamMember[]> {
  const supabase = await createClient()

  const { data: members, error } = await supabase
    .from('firm_members')
    .select('user_id,role,created_at')
    .eq('firm_id', firmId)
    .order('role')

  if (error) throw new Error(`Could not load team members: ${error.message}`)
  if (!members?.length) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id,email,full_name')
    .in('id', members.map((m) => m.user_id))

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]))

  return members.map((m) => ({
    userId: m.user_id,
    email: byId.get(m.user_id)?.email ?? null,
    fullName: byId.get(m.user_id)?.full_name ?? null,
    role: m.role,
    joinedAt: m.created_at,
  }))
}

/** Invites that have not been accepted and have not lapsed. */
export async function listPendingInvites(firmId: string): Promise<PendingInvite[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('firm_invites')
    .select('id,email,role,token,expires_at,created_at')
    .eq('firm_id', firmId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Could not load invites: ${error.message}`)

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    token: row.token,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }))
}
