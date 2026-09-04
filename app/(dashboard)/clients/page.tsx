import type { Metadata } from 'next'
import { listClients } from '@/lib/clients/queries'
import { listTeamMembers } from '@/lib/team/queries'
import { requireFirm } from '@/lib/auth'
import { toAssignable } from '@/lib/team/assignable'
import { SERVICE_TYPES } from '@/lib/validations/client'
import { ClientsTable } from '@/components/clients/clients-table'
import { AddClientButton } from '@/components/clients/add-client-button'
import { ClientFilters } from '@/components/clients/client-filters'
import { PageHeader } from '@/components/ui/page-header'

export const metadata: Metadata = { title: 'Clients' }

export default async function ClientsPage(props: PageProps<'/clients'>) {
  const params = await props.searchParams
  const search = typeof params.q === 'string' ? params.q : undefined
  const rawService = typeof params.service === 'string' ? params.service : undefined
  const service = SERVICE_TYPES.includes(rawService as never) ? rawService : undefined

  const { user, firm } = await requireFirm()
  const teamMembers = await listTeamMembers(firm.firmId)
  const members = toAssignable(teamMembers, user.id)

  // Same validation as /deadlines: an unrecognised value is no filter, not a
  // uuid cast error.
  const rawAssigned = typeof params.assigned === 'string' ? params.assigned : undefined
  const assigned =
    rawAssigned === 'unassigned' || members.some((m) => m.userId === rawAssigned)
      ? rawAssigned
      : undefined

  const clients = await listClients({ search, service, assignedTo: assigned })

  return (
    <>
      <PageHeader
        title="Clients"
        description={
          clients.length === 1 ? '1 client' : `${clients.length} clients`
        }
        action={<AddClientButton members={members} />}
      />
      <ClientFilters search={search} service={service} assigned={assigned} members={members} />
      <ClientsTable
        clients={clients}
        isFiltered={Boolean(search || service || assigned)}
        members={members}
      />
    </>
  )
}
