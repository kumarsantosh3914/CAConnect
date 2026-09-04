import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarClock, FileText, Receipt, Scale } from 'lucide-react'
import { getClient } from '@/lib/clients/queries'
import { clientTypeLabel, formatDate, serviceLabel } from '@/lib/format'
import { stateFromGstin } from '@/lib/validations/india'
import { ClientHeaderActions } from '@/components/clients/client-header-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export async function generateMetadata(props: PageProps<'/clients/[id]'>): Promise<Metadata> {
  const { id } = await props.params
  const client = await getClient(id)
  return { title: client?.name ?? 'Client' }
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value || '—'}</dd>
    </div>
  )
}

export default async function ClientProfilePage(props: PageProps<'/clients/[id]'>) {
  const { id } = await props.params
  const client = await getClient(id)

  // RLS returns nothing for another CA's client, so "not found" and
  // "not yours" are indistinguishable here — which is the correct behaviour.
  if (!client) notFound()

  return (
    <>
      <div className="space-y-4">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/clients" />}>
          <ArrowLeft className="size-4" aria-hidden />
          All clients
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
              {client.archived_at && <Badge variant="secondary">Archived</Badge>}
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline">{clientTypeLabel(client.client_type)}</Badge>
              {client.services.map((service) => (
                <Badge key={service} variant="secondary">
                  {serviceLabel(service)}
                </Badge>
              ))}
            </div>
          </div>
          <ClientHeaderActions client={client} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              <DetailRow label="PAN" value={client.pan && <span className="font-mono">{client.pan}</span>} />
              <DetailRow
                label="GSTIN"
                value={
                  client.gstin && (
                    <span className="font-mono text-xs">{client.gstin}</span>
                  )
                }
              />
              {client.gstin && stateFromGstin(client.gstin) && (
                <DetailRow label="State" value={stateFromGstin(client.gstin)} />
              )}
              <DetailRow
                label="Email"
                value={
                  client.email && (
                    <a href={`mailto:${client.email}`} className="hover:underline">
                      {client.email}
                    </a>
                  )
                }
              />
              <DetailRow
                label="Phone"
                value={
                  client.phone && (
                    <a href={`tel:${client.phone}`} className="hover:underline">
                      {client.phone}
                    </a>
                  )
                }
              />
              {client.services.includes('itr') && (
                <DetailRow label="Audit case" value={client.is_audit_case ? 'Yes' : 'No'} />
              )}
              {client.services.includes('roc') && (
                <DetailRow label="AGM date" value={formatDate(client.agm_date)} />
              )}
              <DetailRow label="Added" value={formatDate(client.created_at)} />
            </dl>
            {client.notes && (
              <p className="mt-4 whitespace-pre-wrap border-t pt-4 text-sm text-muted-foreground">
                {client.notes}
              </p>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="deadlines">
          <TabsList>
            <TabsTrigger value="deadlines">Deadlines</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="fees">Fees</TabsTrigger>
            <TabsTrigger value="notices">Notices</TabsTrigger>
          </TabsList>

          <TabsContent value="deadlines">
            <EmptyState
              icon={CalendarClock}
              title="No deadlines yet"
              description="Compliance deadlines appear here once the tracker is switched on for this client."
            />
          </TabsContent>
          <TabsContent value="documents">
            <EmptyState
              icon={FileText}
              title="No documents yet"
              description="Send this client an upload link and their files land here."
            />
          </TabsContent>
          <TabsContent value="fees">
            <EmptyState
              icon={Receipt}
              title="No fees logged"
              description="Track what this client has been invoiced and what they have paid."
            />
          </TabsContent>
          <TabsContent value="notices">
            <EmptyState
              icon={Scale}
              title="No notices yet"
              description="IT and GST notices drafted for this client will be listed here."
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
