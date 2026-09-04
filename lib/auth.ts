import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

/**
 * The authentication gate for Server Components and Server Actions.
 * Redirects to /login when there is no session.
 */
export async function requireUser(): Promise<User> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  return user
}

/**
 * The same check for Route Handlers, which must return a response rather than
 * redirect. Every API route starts with this — per CLAUDE.md, no DB query
 * happens before the user is verified.
 */
export async function getApiUser(): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function getOptionalUser(): Promise<User | null> {
  return getApiUser()
}
