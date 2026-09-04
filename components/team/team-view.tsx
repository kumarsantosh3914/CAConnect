'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Mail, Trash2, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { inviteMember, removeMember, revokeInvite } from '@/app/(dashboard)/team/actions'
import type { PendingInvite, TeamMember } from '@/lib/team/queries'
import { formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export type SeatState = {
  used: number
  /** null means unlimited. */
  max: number | null
  atCap: boolean
  message: string
}

export function TeamView({
  members,
  invites,
  isOwner,
  currentUserId,
  seats,
}: {
  members: TeamMember[]
  invites: PendingInvite[]
  isOwner: boolean
  currentUserId: string
  seats: SeatState
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  // The link is shown after creating an invite, because it has to be sent by
  // hand until a verified sending domain exists.
  const [newLink, setNewLink] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      toast.success('Invitation link copied')
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast.error('Could not copy. Select the link and copy it manually.')
    }
  }

  function onInvite() {
    setError(null)
    startTransition(async () => {
      const result = await inviteMember({ email, role: 'staff' })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setNewLink(result.url)
      setEmail('')
      router.refresh()
    })
  }

  function onRevoke(invite: PendingInvite) {
    startTransition(async () => {
      const result = await revokeInvite(invite.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Invitation revoked')
      router.refresh()
    })
  }

  function onRemove(member: TeamMember) {
    if (!confirm(`Remove ${member.email ?? 'this person'} from the firm? Their work stays with the firm.`)) return
    startTransition(async () => {
      const result = await removeMember(member.userId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Removed from the firm')
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            People ({seats.max ? `${seats.used} of ${seats.max}` : members.length})
          </h2>
          {isOwner && !seats.atCap && (
            <Button onClick={() => { setNewLink(null); setError(null); setInviteOpen(true) }}>
              <UserPlus className="size-4" aria-hidden />
              Invite someone
            </Button>
          )}
        </div>

        {isOwner && seats.atCap && (
          <Alert>
            <AlertDescription>
              {seats.message} Ask us to move you up — there is no card to enter.
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden sm:table-cell">Joined</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.userId}>
                  <TableCell>
                    <span className="font-medium">
                      {member.fullName || member.email || 'Unknown'}
                    </span>
                    {member.userId === currentUserId && (
                      <span className="ml-2 text-xs text-muted-foreground">you</span>
                    )}
                    {member.fullName && member.email && (
                      <span className="block text-xs text-muted-foreground">{member.email}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                      {member.role === 'owner' ? 'Owner' : 'Staff'}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {formatDate(member.joinedAt)}
                  </TableCell>
                  <TableCell>
                    {isOwner && member.userId !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={isPending}
                        onClick={() => onRemove(member)}
                        aria-label={`Remove ${member.email ?? 'member'}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">
          Pending invitations ({invites.length})
        </h2>
        {invites.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No pending invitations"
            description={
              isOwner
                ? 'Invite a colleague and share the link with them.'
                : 'Only the firm owner can invite people.'
            }
          />
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead className="hidden sm:table-cell">Expires</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">{invite.email}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {formatDate(invite.expiresAt)}
                    </TableCell>
                    <TableCell>
                      {isOwner && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              copy(`${window.location.origin}/invite/${invite.token}`, invite.id)
                            }
                            aria-label={`Copy invitation link for ${invite.email}`}
                          >
                            {copied === invite.id ? <Check className="size-4" /> : <Copy className="size-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={isPending}
                            onClick={() => onRevoke(invite)}
                            aria-label={`Revoke invitation for ${invite.email}`}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite someone to the firm</DialogTitle>
            <DialogDescription>
              They will see the clients, deadlines and documents assigned to them.
            </DialogDescription>
          </DialogHeader>

          {newLink ? (
            <div className="space-y-3">
              <Alert>
                <AlertDescription className="text-sm">
                  Invitation created. Send them this link — it only works for the email
                  address you invited, and expires in 14 days.
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Input readOnly value={newLink} className="font-mono text-xs" aria-label="Invitation link" />
                <Button variant="outline" size="icon" onClick={() => copy(newLink, 'new')}>
                  {copied === 'new' ? <Check className="size-4" /> : <Copy className="size-4" />}
                  <span className="sr-only">Copy invitation link</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Field label="Their email" htmlFor="invite_email" required>
                <Input
                  id="invite_email"
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="junior@yourfirm.in"
                />
              </Field>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              {newLink ? 'Done' : 'Cancel'}
            </Button>
            {!newLink && (
              <Button disabled={isPending || !email.trim()} onClick={onInvite}>
                {isPending ? 'Creating…' : 'Create invitation'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
