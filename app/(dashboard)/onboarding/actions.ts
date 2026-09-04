'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getApiUser } from '@/lib/auth'

const profileSchema = z.object({
  firm_name: z.string().trim().min(1, 'What is your firm called?').max(120),
  full_name: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
})

export type OnboardingResult = { ok: true } | { ok: false; error: string }

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
  const { error } = await supabase
    .from('profiles')
    .update({
      firm_name: parsed.data.firm_name,
      full_name: parsed.data.full_name || null,
      city: parsed.data.city || null,
    })
    .eq('id', user.id)

  if (error) return { ok: false, error: 'Could not save your firm details.' }

  revalidatePath('/dashboard')
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
