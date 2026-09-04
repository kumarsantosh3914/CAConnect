import type { Metadata } from 'next'
import { bucketDeadlines, listDeadlines } from '@/lib/deadlines/queries'
import { listClients } from '@/lib/clients/queries'
import { listTeamMembers } from '@/lib/team/queries'
import { requireFirm } from '@/lib/auth'
import { toAssignable } from '@/lib/team/assignable'
import { SERVICE_TYPES } from '@/lib/validations/client'
import { DeadlineBuckets } from '@/components/deadlines/deadline-buckets'
import { DeadlineFilters } from '@/components/deadlines/deadline-filters'
import { AddDeadlineButton } from '@/components/deadlines/add-deadline-button'
import { PageHeader } from '@/components/ui/page-header'

export const metadata: Metadata = { title: 'Deadlines' }

export default async function DeadlinesPage(props: PageProps<'/deadlines'>) {
  const params = await props.searchParams
  const clientId = typeof params.client === 'string' ? params.client : undefined
  const rawService = typeof params.service === 'string' ? params.service : undefined
  const service = SERVICE_TYPES.includes(rawService as never) ? rawService : undefined
  const includeCompleted = params.completed === '1'

  const { user, firm } = await requireFirm()
  const teamMembers = await listTeamMembers(firm.firmId)
  const members = toAssignable(teamMembers, user.id)

  // In a firm with more than one person, a staff member lands on their own
  // queue rather than the whole firm's — that is the "sees only their queue"
  // intent, as a default view they can change, not as a wall.
  // Only 'unassigned' or somebody actually in this firm. Anything else — a
  // stale bookmark, a hand-edited URL, the literal string 'all' — is ignored
  // rather than passed to Postgres, which would 500 on an invalid uuid.
  const rawAssigned = typeof params.assigned === 'string' ? params.assigned : undefined
  const assignedParam =
    rawAssigned === 'unassigned' || members.some((m) => m.userId === rawAssigned)
      ? rawAssigned
      : undefined
  const assigned =
    assignedParam ?? (members.length > 1 && firm.role === 'staff' ? user.id : undefined)

  const [deadlines, clients] = await Promise.all([
    listDeadlines({ clientId, service, includeCompleted, assignedTo: assigned }),
    listClients(),
  ])

  const buckets = bucketDeadlines(deadlines)
  const overdueCount = buckets[0].deadlines.length

  return (
    <>
      <PageHeader
        title="Deadlines"
        description={
          overdueCount > 0
            ? `${overdueCount} overdue · ${deadlines.length} open`
            : `${deadlines.length} open`
        }
        action={<AddDeadlineButton clients={clients.map((c) => ({ id: c.id, name: c.name }))} />}
      />

      <DeadlineFilters
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        clientId={clientId}
        service={service}
        includeCompleted={includeCompleted}
        assigned={assigned}
        members={members}
      />

      <DeadlineBuckets
        buckets={buckets}
        members={members}
        emptyTitle={
          clientId || service || assigned
            ? 'No deadlines match those filters'
            : 'No deadlines yet'
        }
        emptyDescription={
          clientId || service || assigned
            ? 'Try clearing the filters.'
            : 'Tag a client with a service (ITR, GST, TDS, ROC) and their compliance calendar fills in automatically.'
        }
      />
    </>
  )
}
