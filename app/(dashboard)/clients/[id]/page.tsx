import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getClient } from '@/lib/clients/queries'
import { bucketDeadlines, listDeadlines } from '@/lib/deadlines/queries'
import { listDocumentRequests, listDocuments } from '@/lib/documents/queries'
import { listFees } from '@/lib/fees/queries'
import { listNotices } from '@/lib/notices/queries'
import { listClientEmails } from '@/lib/client-emails/queries'
import { getClientPortal } from '@/lib/portal/queries'
import { requestOrigin } from '@/lib/url'
import { planLimits, portalUpgradeMessage } from '@/lib/plans'
import { listTeamMembers } from '@/lib/team/queries'
import { toAssignable } from '@/lib/team/assignable'
import { ClientEmailList } from '@/components/client-emails/email-list'
import { FeesView } from '@/components/fees/fees-view'
import { NoticesList } from '@/components/notices/notices-list'
import { requireFirm } from '@/lib/auth'
import { DocumentList, DocumentRequestList } from '@/components/documents/document-lists'
import { RequestDocumentsButton } from '@/components/documents/request-documents-button'
import { DeadlineBuckets } from '@/components/deadlines/deadline-buckets'
import { PortalCard } from '@/components/portal/portal-card'
import { clientTypeLabel, formatDate, serviceLabel } from '@/lib/format'
import { stateFromGstin } from '@/lib/validations/india'
import { ClientHeaderActions } from '@/components/clients/client-header-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export async function generateMetadata(props: PageProps<'/clients/[id]'>): Promise<Metadata> {
  const { id } = await props.params
  const client = await getClient(id)
  return { title: client?.name ?? 'Client' }
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      {/*
        The label holds its width; the value gives way. A long GSTIN or email
        has no spaces to wrap at, so without min-w-0 and a break the value sets
        a min-content width the card cannot honour and the whole page scrolls
        sideways on a phone.
      */}
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 [overflow-wrap:anywhere] text-right font-medium">{value || '—'}</dd>
    </div>
  )
}

export default async function ClientProfilePage(props: PageProps<'/clients/[id]'>) {
  const { id } = await props.params
  const client = await getClient(id)

  // RLS returns nothing for another CA's client, so "not found" and
  // "not yours" are indistinguishable here — which is the correct behaviour.
  if (!client) notFound()

  const { user, firm } = await requireFirm()
  const [deadlines, requests, documents, fees, notices, emails, teamMembers, portal, origin] =
    await Promise.all([
      listDeadlines({ clientId: id, includeCompleted: true }),
      listDocumentRequests(id),
      listDocuments(id),
      listFees({ clientId: id }),
      listNotices(id),
      listClientEmails(id),
      listTeamMembers(firm.firmId),
      getClientPortal(id),
      requestOrigin(),
    ])
  const members = toAssignable(teamMembers, user.id)

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
          <ClientHeaderActions client={client} members={members} />
        </div>
      </div>

      {/*
        min-w-0 on both grid children. A grid item defaults to min-width:auto,
        so it refuses to shrink below its content's min-content width — on a
        phone the details card sat 36px wider than its own track and scrolled
        the whole page sideways.
      */}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit min-w-0">
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

        <Tabs defaultValue="deadlines" className="min-w-0">
          {/* Six tabs do not fit a 390px screen, so let the strip scroll. */}
          <TabsList className="max-w-full overflow-x-auto">
            <TabsTrigger value="deadlines">Deadlines</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="fees">Fees</TabsTrigger>
            <TabsTrigger value="notices">Notices</TabsTrigger>
            <TabsTrigger value="emails">Emails</TabsTrigger>
            <TabsTrigger value="portal">Portal</TabsTrigger>
          </TabsList>

          <TabsContent value="deadlines">
            <DeadlineBuckets
              buckets={bucketDeadlines(deadlines)}
              showClient={false}
              members={members}
              emptyTitle="No deadlines yet"
              emptyDescription="Tag this client with a service and their compliance calendar fills in automatically."
            />
          </TabsContent>
          <TabsContent value="documents" className="space-y-4">
            <div className="flex justify-end">
              <RequestDocumentsButton
                clients={[{ id: client.id, name: client.name, phone: client.phone }]}
                defaultClientId={client.id}
                firmName={firm.name}
                label="Request documents"
              />
            </div>
            <DocumentRequestList
              requests={requests}
              showClient={false}
              firmName={firm.name}
            />
            <DocumentList documents={documents} showClient={false} />
          </TabsContent>
          <TabsContent value="fees" className="space-y-4">
            <FeesView
              fees={fees}
              clients={[{ id: client.id, name: client.name }]}
              showClient={false}
              defaultClientId={client.id}
            />
          </TabsContent>
          <TabsContent value="notices">
            <NoticesList notices={notices} showClient={false} />
          </TabsContent>
          <TabsContent value="emails" className="space-y-4">
            <div className="flex justify-end">
              <Button nativeButton={false} render={<Link href={`/client-emails/new?client=${client.id}`} />}>
                Draft an email
              </Button>
            </div>
            <ClientEmailList emails={emails} showClient={false} />
          </TabsContent>
          <TabsContent value="portal">
            <PortalCard
              clientId={client.id}
              clientName={client.name}
              clientPhone={client.phone}
              firmName={firm.name}
              entitlement={
                planLimits(firm.plan).clientPortal ? null : portalUpgradeMessage(firm.plan)
              }
              portal={
                portal
                  ? {
                      url: `${origin}/portal/${portal.token}`,
                      isActive: portal.is_active,
                      lastViewedAt: portal.last_viewed_at,
                      viewCount: portal.view_count,
                    }
                  : null
              }
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
