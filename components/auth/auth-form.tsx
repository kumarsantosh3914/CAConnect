'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

const schema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormValues = z.infer<typeof schema>

/**
 * Supabase surfaces terse technical errors ("Invalid login credentials").
 * CLAUDE.md requires human-readable messages, so map the ones CAs will hit.
 */
function friendlyAuthError(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials')) {
    return 'That email and password combination did not work. Check both and try again.'
  }
  if (normalized.includes('email not confirmed')) {
    return 'Please confirm your email first — check your inbox for the link we sent.'
  }
  if (normalized.includes('user already registered')) {
    return 'An account with this email already exists. Try logging in instead.'
  }
  if (normalized.includes('rate limit') || normalized.includes('too many')) {
    return 'Too many attempts. Please wait a minute and try again.'
  }
  return 'Something went wrong on our side. Please try again in a moment.'
}

export function AuthForm({
  mode,
  next = '/dashboard',
}: {
  mode: 'login' | 'signup'
  /** Where to land after auth. Read server-side so this stays prerenderable. */
  next?: string
}) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: FormValues) {
    setFormError(null)
    const supabase = createClient()

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      })
      if (error) return setFormError(friendlyAuthError(error.message))

      // With email confirmation on, there is no session yet.
      if (!data.session) return setCheckEmail(true)
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      })
      if (error) return setFormError(friendlyAuthError(error.message))
    }

    router.push(next)
    router.refresh()
  }

  async function signInWithGoogle() {
    setFormError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (error) setFormError(friendlyAuthError(error.message))
  }

  if (checkEmail) {
    return (
      <Alert>
        <AlertDescription>
          Almost there — we sent you a confirmation link. Open it to activate your account.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@firm.in"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            aria-invalid={!!errors.password}
            {...register('password')}
          />
          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting
            ? 'Please wait…'
            : mode === 'signup'
              ? 'Create account'
              : 'Log in'}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-muted/30 px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <Button type="button" variant="outline" className="w-full" onClick={signInWithGoogle}>
        Continue with Google
      </Button>
    </div>
  )
}
