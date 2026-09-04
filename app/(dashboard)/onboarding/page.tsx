import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'

export const metadata: Metadata = { title: 'Welcome' }

export default async function OnboardingPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('firm_name,full_name,city,onboarded_at')
    .eq('id', user.id)
    .maybeSingle()

  // Already done — don't make them walk it again.
  if (profile?.onboarded_at) redirect('/dashboard')

  return (
    <OnboardingWizard
      defaultFirmName={profile?.firm_name ?? ''}
      defaultFullName={profile?.full_name ?? ''}
      defaultCity={profile?.city ?? ''}
    />
  )
}
