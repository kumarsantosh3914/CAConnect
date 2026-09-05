import type { Metadata } from 'next'
import { listClients } from '@/lib/clients/queries'
import { NewMatterForm } from '@/components/notices/new-matter-form'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Add notice matter' }

export default async function NewMatterPage() {
  const clients = await listClients()
  return (
    <>
      <PageHeader
        title="Add notice matter"
        description="Track deadlines, hearings and the complete notice lifecycle."
      />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Matter details</CardTitle>
        </CardHeader>
        <CardContent>
          <NewMatterForm clients={clients.map((client) => ({ id: client.id, name: client.name }))} />
        </CardContent>
      </Card>
    </>
  )
}
