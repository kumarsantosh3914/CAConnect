import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { listDocumentRequests, listDocuments } from '@/lib/documents/queries'
import { listClients } from '@/lib/clients/queries'
import { RequestDocumentsButton } from '@/components/documents/request-documents-button'
import { DocumentList, DocumentRequestList } from '@/components/documents/document-lists'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const metadata: Metadata = { title: 'Documents' }

export default async function DocumentsPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [requests, documents, clients, { data: profile }] = await Promise.all([
    listDocumentRequests(),
    listDocuments(),
    listClients(),
    supabase.from('profiles').select('firm_name').eq('id', user.id).maybeSingle(),
  ])

  const openRequests = requests.filter((request) => request.status === 'open').length

  return (
    <>
      <PageHeader
        title="Documents"
        description={
          openRequests > 0
            ? `${openRequests} link${openRequests === 1 ? '' : 's'} awaiting upload`
            : `${documents.length} file${documents.length === 1 ? '' : 's'} received`
        }
        action={
          <RequestDocumentsButton
            clients={clients.map((c) => ({ id: c.id, name: c.name, phone: c.phone }))}
            firmName={profile?.firm_name ?? null}
          />
        }
      />

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Requests ({requests.length})</TabsTrigger>
          <TabsTrigger value="files">Files ({documents.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="requests">
          <DocumentRequestList requests={requests} firmName={profile?.firm_name ?? null} />
        </TabsContent>
        <TabsContent value="files">
          <DocumentList documents={documents} />
        </TabsContent>
      </Tabs>
    </>
  )
}
