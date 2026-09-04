'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { ClientFormDialog } from './client-form-dialog'
import { clientDefaults } from '@/lib/validations/client'
import type { AssignableMember } from '@/lib/team/assignable'
import { Button } from '@/components/ui/button'

export function AddClientButton({
  label = 'Add client',
  members = [],
}: {
  label?: string
  members?: AssignableMember[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        {label}
      </Button>
      <ClientFormDialog
        open={open}
        onOpenChange={setOpen}
        defaultValues={clientDefaults}
        members={members}
        onSaved={(id) => router.push(`/clients/${id}`)}
      />
    </>
  )
}
