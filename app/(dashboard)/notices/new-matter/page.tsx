import type { Metadata } from 'next'
import { listClients } from '@/lib/clients/queries'
import { NewMatterForm } from '@/components/notices/new-matter-form'
import { PageHeader } from '@/components/ui/page-header'

export const metadata: Metadata = { title: 'Add notice matter' }

export default async function NewMatterPage() {
  const clients = await listClients()
  return <><PageHeader title="Add notice matter" description="Track deadlines, hearings and the complete notice lifecycle." /><NewMatterForm clients={clients.map((client) => ({ id: client.id, name: client.name }))} /></>
}
