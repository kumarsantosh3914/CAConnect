import type { Metadata } from 'next'
import { bucketDeadlines, listDeadlines } from '@/lib/deadlines/queries'
import { listClients } from '@/lib/clients/queries'
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

  const [deadlines, clients] = await Promise.all([
    listDeadlines({ clientId, service, includeCompleted }),
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
      />

      <DeadlineBuckets
        buckets={buckets}
        emptyTitle={
          clientId || service ? 'No deadlines match those filters' : 'No deadlines yet'
        }
        emptyDescription={
          clientId || service
            ? 'Try clearing the filters.'
            : 'Tag a client with a service (ITR, GST, TDS, ROC) and their compliance calendar fills in automatically.'
        }
      />
    </>
  )
}
