import type { Metadata } from 'next'
import { listClients } from '@/lib/clients/queries'
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

  const clients = await listClients({ search, service })

  return (
    <>
      <PageHeader
        title="Clients"
        description={
          clients.length === 1 ? '1 client' : `${clients.length} clients`
        }
        action={<AddClientButton />}
      />
      <ClientFilters search={search} service={service} />
      <ClientsTable clients={clients} isFiltered={Boolean(search || service)} />
    </>
  )
}
