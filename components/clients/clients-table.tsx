'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Pencil, Archive, Users } from 'lucide-react'
import { toast } from 'sonner'
import { ClientFormDialog } from './client-form-dialog'
import { archiveClient } from '@/app/(dashboard)/clients/actions'
import { clientDefaults } from '@/lib/validations/client'
import type { ClientInput } from '@/lib/validations/client'
import { clientTypeLabel, serviceLabel } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export type ClientListRow = {
  id: string
  name: string
  client_type: string
  pan: string | null
  gstin: string | null
  email: string | null
  phone: string | null
  notes: string | null
  agm_date: string | null
  is_audit_case: boolean
  services: string[]
}

function toFormValues(row: ClientListRow): ClientInput {
  return {
    name: row.name,
    client_type: row.client_type as ClientInput['client_type'],
    pan: row.pan ?? '',
    gstin: row.gstin ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    notes: row.notes ?? '',
    agm_date: row.agm_date ?? '',
    is_audit_case: row.is_audit_case,
    services: row.services as ClientInput['services'],
  }
}

export function ClientsTable({
  clients,
  isFiltered,
}: {
  clients: ClientListRow[]
  isFiltered: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<ClientListRow | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  async function onArchive(row: ClientListRow) {
    const result = await archiveClient(row.id)
    if (!result.ok) return toast.error(result.error)
    toast.success(`${row.name} archived`, { description: 'Their history is kept.' })
    router.refresh()
  }

  if (clients.length === 0) {
    return (
      <>
        <EmptyState
          icon={Users}
          title={isFiltered ? 'No clients match those filters' : 'No clients yet'}
          description={
            isFiltered
              ? 'Try clearing the search or the service filter.'
              : 'Add your first client to start tracking their deadlines, documents and fees.'
          }
          action={
            isFiltered ? (
              <Button variant="outline" nativeButton={false} render={<Link href="/clients" />}>
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => setAddOpen(true)}>Add your first client</Button>
            )
          }
        />
        <ClientFormDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          defaultValues={clientDefaults}
          onSaved={() => router.refresh()}
        />
      </>
    )
  }

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Type</TableHead>
              <TableHead className="hidden md:table-cell">PAN</TableHead>
              <TableHead>Services</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <Link href={`/clients/${client.id}`} className="font-medium hover:underline">
                    {client.name}
                  </Link>
                  {client.phone && (
                    <span className="block text-xs text-muted-foreground">{client.phone}</span>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">
                  {clientTypeLabel(client.client_type)}
                </TableCell>
                <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                  {client.pan ?? '—'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {client.services.length === 0 ? (
                      <span className="text-xs text-muted-foreground">None</span>
                    ) : (
                      client.services.map((service) => (
                        <Badge key={service} variant="secondary" className="text-xs">
                          {serviceLabel(service)}
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${client.name}`}>
                          <MoreHorizontal />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditing(client)}>
                        <Pencil className="size-4" aria-hidden />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => onArchive(client)}>
                        <Archive className="size-4" aria-hidden />
                        Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <ClientFormDialog
          key={editing.id}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          clientId={editing.id}
          defaultValues={toFormValues(editing)}
          onSaved={() => router.refresh()}
        />
      )}
    </>
  )
}
