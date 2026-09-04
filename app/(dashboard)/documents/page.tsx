import type { Metadata } from 'next'
import { requireFirm } from '@/lib/auth'
import { listDocumentRequests, listDocuments } from '@/lib/documents/queries'
import { listClients } from '@/lib/clients/queries'
import { RequestDocumentsButton } from '@/components/documents/request-documents-button'
import { DocumentList, DocumentRequestList } from '@/components/documents/document-lists'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const metadata: Metadata = { title: 'Documents' }

export default async function DocumentsPage() {
  const { firm } = await requireFirm()

  const [requests, documents, clients] = await Promise.all([
    listDocumentRequests(),
    listDocuments(),
    listClients(),
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
            firmName={firm.name}
          />
        }
      />

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Requests ({requests.length})</TabsTrigger>
          <TabsTrigger value="files">Files ({documents.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="requests">
          <DocumentRequestList requests={requests} firmName={firm.name} />
        </TabsContent>
        <TabsContent value="files">
          <DocumentList documents={documents} />
        </TabsContent>
      </Tabs>
    </>
  )
}
