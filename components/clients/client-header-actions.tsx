'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, Pencil, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { ClientFormDialog } from './client-form-dialog'
import { archiveClient, restoreClient } from '@/app/(dashboard)/clients/actions'
import type { ClientInput } from '@/lib/validations/client'
import { Button } from '@/components/ui/button'

type ClientRecord = {
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
  archived_at: string | null
  services: string[]
}

export function ClientHeaderActions({ client }: { client: ClientRecord }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)

  const defaultValues: ClientInput = {
    name: client.name,
    client_type: client.client_type as ClientInput['client_type'],
    pan: client.pan ?? '',
    gstin: client.gstin ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    notes: client.notes ?? '',
    agm_date: client.agm_date ?? '',
    is_audit_case: client.is_audit_case,
    services: client.services as ClientInput['services'],
  }

  async function onArchive() {
    const result = await archiveClient(client.id)
    if (!result.ok) return toast.error(result.error)
    toast.success(`${client.name} archived`, { description: 'Their history is kept.' })
    router.refresh()
  }

  async function onRestore() {
    const result = await restoreClient(client.id)
    if (!result.ok) return toast.error(result.error)
    toast.success(`${client.name} restored`)
    router.refresh()
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => setEditOpen(true)}>
        <Pencil className="size-4" aria-hidden />
        Edit
      </Button>
      {client.archived_at ? (
        <Button variant="outline" onClick={onRestore}>
          <RotateCcw className="size-4" aria-hidden />
          Restore
        </Button>
      ) : (
        <Button variant="destructive" onClick={onArchive}>
          <Archive className="size-4" aria-hidden />
          Archive
        </Button>
      )}

      <ClientFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        clientId={client.id}
        defaultValues={defaultValues}
        onSaved={() => router.refresh()}
      />
    </div>
  )
}
