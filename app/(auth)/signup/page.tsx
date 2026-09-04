import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthForm } from '@/components/auth/auth-form'

export const metadata: Metadata = { title: 'Sign up' }

export default async function SignupPage(props: PageProps<'/signup'>) {
  const { next } = await props.searchParams
  const safeNext = typeof next === 'string' && next.startsWith('/') ? next : '/dashboard'

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Start free</h1>
        <p className="text-sm text-muted-foreground">
          No credit card. Set up your firm in under 5 minutes.
        </p>
      </div>
      <AuthForm mode="signup" next={safeNext} />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Log in
        </Link>
      </p>
    </div>
  )
}
