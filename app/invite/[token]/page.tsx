import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOptionalUser } from '@/lib/auth'
import { AcceptInvite } from '@/components/team/accept-invite'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Join a firm',
  // An invitation link should never end up in search results.
  robots: { index: false, follow: false },
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-16">
      <div className="rounded-lg border bg-card p-6 shadow-sm">{children}</div>
    </main>
  )
}

export default async function InvitePage(props: PageProps<'/invite/[token]'>) {
  const { token } = await props.params
  const supabase = await createClient()
  const user = await getOptionalUser()

  // firm_invite_preview is a SECURITY DEFINER function: an invitee is not a
  // member yet, so they cannot read firm_invites through RLS. It returns only
  // the firm's name and the role on offer.
  const { data } = await supabase.rpc('firm_invite_preview', { invite_token: token })
  const invite = Array.isArray(data) ? data[0] : null

  if (!invite) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold tracking-tight">This invitation is not valid</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have expired, already been used, or been revoked. Ask whoever invited you to
          send a new one.
        </p>
      </Shell>
    )
  }

  if (!user) {
    // Come back here after signing in, so the link still works end to end.
    const next = encodeURIComponent(`/invite/${token}`)
    return (
      <Shell>
        <h1 className="text-xl font-semibold tracking-tight">
          You have been invited to join {invite.firm_name ?? 'a firm'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This invitation was sent to <strong>{invite.email}</strong>. Sign in with that email
          address to accept it.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button nativeButton={false} render={<Link href={`/signup?next=${next}`} />}>
            Create an account
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href={`/login?next=${next}`} />}>
            Log in
          </Button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <h1 className="text-xl font-semibold tracking-tight">
        Join {invite.firm_name ?? 'this firm'}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You will be added as {invite.role === 'owner' ? 'an owner' : 'a staff member'} and will
        see the clients, deadlines and documents assigned to you.
      </p>
      <AcceptInvite
        token={token}
        invitedEmail={invite.email}
        signedInAs={user.email ?? ''}
      />
    </Shell>
  )
}
