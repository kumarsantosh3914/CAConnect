'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { acceptInvite } from '@/app/(dashboard)/team/actions'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function AcceptInvite({
  token,
  invitedEmail,
  signedInAs,
}: {
  token: string
  invitedEmail: string
  signedInAs: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // The database enforces this too; saying it here means the person is not
  // surprised by a rejection after clicking.
  const mismatch = signedInAs.toLowerCase() !== invitedEmail.toLowerCase()

  function onAccept() {
    setError(null)
    startTransition(async () => {
      const result = await acceptInvite(token)
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success('You have joined the firm')
      router.push('/dashboard')
      router.refresh()
    })
  }

  return (
    <div className="mt-6 space-y-4">
      {mismatch && (
        <Alert variant="destructive">
          <AlertDescription>
            This invitation was sent to <strong>{invitedEmail}</strong>, but you are signed in as{' '}
            <strong>{signedInAs}</strong>. Sign in with the invited address to accept it.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button disabled={isPending || mismatch} onClick={onAccept}>
        {isPending ? 'Joining…' : 'Accept invitation'}
      </Button>
    </div>
  )
}
