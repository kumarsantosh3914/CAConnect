'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getApiUser, getFirmContext } from '@/lib/auth'

const profileSchema = z.object({
  firm_name: z.string().trim().min(1, 'What is your firm called?').max(120),
  full_name: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
})

export type OnboardingResult = { ok: true } | { ok: false; error: string }

/**
 * Creates the firm on first run, or renames it on a repeat visit.
 *
 * The firm and the founding membership are two inserts, and the second is
 * what makes the first usable — a firm with no members is invisible to its
 * own creator, since every read policy is membership-scoped. If the
 * membership insert fails we delete the firm rather than leave one stranded
 * that nobody can see or ever claim.
 */
export async function saveFirmDetails(
  input: z.infer<typeof profileSchema>
): Promise<OnboardingResult> {
  const user = await getApiUser()
  if (!user) return { ok: false, error: 'Your session has expired. Please log in again.' }

  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form.' }
  }

  const supabase = await createClient()

  // Person-level details stay on the profile.
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.full_name || null })
    .eq('id', user.id)
  if (profileError) return { ok: false, error: 'Could not save your details.' }

  const existing = await getFirmContext()

  if (existing) {
    if (existing.role !== 'owner') {
      return { ok: false, error: 'Only the firm owner can change these details.' }
    }
    const { error } = await supabase
      .from('firms')
      .update({ name: parsed.data.firm_name, city: parsed.data.city || null })
      .eq('id', existing.firmId)
    if (error) return { ok: false, error: 'Could not save your firm details.' }
  } else {
    const { data: firm, error } = await supabase
      .from('firms')
      .insert({
        name: parsed.data.firm_name,
        city: parsed.data.city || null,
        // The founding-owner policy checks this against auth.uid(), so a firm
        // can only ever be claimed by the person who created it.
        created_by: user.id,
      })
      .select('id')
      .single()
    if (error || !firm) return { ok: false, error: 'Could not create your firm.' }

    const { error: memberError } = await supabase
      .from('firm_members')
      .insert({ firm_id: firm.id, user_id: user.id, role: 'owner' })

    if (memberError) {
      await supabase.from('firms').delete().eq('id', firm.id)
      return { ok: false, error: 'Could not set you up as the firm owner. Please try again.' }
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/onboarding')
  return { ok: true }
}

/** Marks onboarding done so the wizard stops appearing. */
export async function completeOnboarding(): Promise<OnboardingResult> {
  const user = await getApiUser()
  if (!user) return { ok: false, error: 'Your session has expired. Please log in again.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { ok: false, error: 'Could not finish setup.' }

  revalidatePath('/dashboard')
  return { ok: true }
}
