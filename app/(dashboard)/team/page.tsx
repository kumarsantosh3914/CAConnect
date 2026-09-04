import type { Metadata } from 'next'
import { requireFirm } from '@/lib/auth'
import { listPendingInvites, listTeamMembers } from '@/lib/team/queries'
import { TeamView } from '@/components/team/team-view'
import { planLimits, seatLimitMessage } from '@/lib/plans'
import { PageHeader } from '@/components/ui/page-header'

export const metadata: Metadata = { title: 'Team' }

export default async function TeamPage() {
  const { user, firm } = await requireFirm()

  // A staff member may see who else is in the firm; only the owner sees the
  // invite controls, and the actions re-check that server-side regardless.
  const [members, invites] = await Promise.all([
    listTeamMembers(firm.firmId),
    firm.role === 'owner' ? listPendingInvites(firm.firmId) : Promise.resolve([]),
  ])

  // A pending invite is a seat already promised, so it counts toward the cap
  // here exactly as it does in inviteMember().
  const { maxMembers } = planLimits(firm.plan)
  const seatsUsed = members.length + invites.length
  const seats = {
    used: seatsUsed,
    max: Number.isFinite(maxMembers) ? maxMembers : null,
    atCap: seatsUsed >= maxMembers,
    message: seatLimitMessage(firm.plan),
  }

  return (
    <>
      <PageHeader
        title="Team"
        description={
          firm.name ? `Who can work in ${firm.name}.` : 'Who can work in this firm.'
        }
      />
      <TeamView
        members={members}
        invites={invites}
        isOwner={firm.role === 'owner'}
        currentUserId={user.id}
        seats={seats}
      />
    </>
  )
}
