import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireUser, getFirmContext } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'

export const metadata: Metadata = { title: 'Welcome' }

export default async function OnboardingPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [{ data: profile }, firm] = await Promise.all([
    supabase.from('profiles').select('full_name,onboarded_at').eq('id', user.id).maybeSingle(),
    getFirmContext(),
  ])

  // Already done — don't make them walk it again.
  if (profile?.onboarded_at) redirect('/dashboard')

  return (
    <OnboardingWizard
      defaultFirmName={firm?.name ?? ''}
      defaultFullName={profile?.full_name ?? ''}
      defaultCity={firm?.city ?? ''}
    />
  )
}
