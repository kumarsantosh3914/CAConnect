import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthForm } from '@/components/auth/auth-form'

export const metadata: Metadata = { title: 'Log in' }

export default async function LoginPage(props: PageProps<'/login'>) {
  const { next } = await props.searchParams
  // Only same-origin paths — `next` is attacker-controllable via the URL.
  const safeNext = typeof next === 'string' && next.startsWith('/') ? next : '/dashboard'

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Log in to your CAConnect account</p>
      </div>
      <AuthForm mode="login" next={safeNext} />
      <p className="text-center text-sm text-muted-foreground">
        New here?{' '}
        <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </div>
  )
}
