'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Plus, Receipt, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { FeeFormDialog } from './fee-form-dialog'
import { deleteFee, updateFeeStatus } from '@/app/(dashboard)/fees/actions'
import type { FeeRecord } from '@/lib/fees/queries'
import type { FeeInput } from '@/lib/validations/fee'
import { formatDate, formatPaise, paiseToRupees, serviceLabel } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

function toFormValues(fee: FeeRecord): FeeInput {
  return {
    client_id: fee.client_id,
    service_type: (fee.service_type ?? '') as FeeInput['service_type'],
    description: fee.description,
    amount: String(paiseToRupees(fee.amount_paise)),
    status: fee.status,
    due_date: fee.due_date ?? '',
  }
}

export function FeesView({
  fees,
  clients,
  showClient = true,
  defaultClientId,
}: {
  fees: FeeRecord[]
  clients: { id: string; name: string }[]
  showClient?: boolean
  defaultClientId?: string
}) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<FeeRecord | null>(null)
  const [isPending, startTransition] = useTransition()

  function setStatus(fee: FeeRecord, status: FeeRecord['status']) {
    startTransition(async () => {
      const result = await updateFeeStatus(fee.id, status)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  function onDelete(fee: FeeRecord) {
    startTransition(async () => {
      const result = await deleteFee(fee.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Fee removed')
      router.refresh()
    })
  }

  const addDefaults: FeeInput | undefined = defaultClientId
    ? {
        client_id: defaultClientId,
        service_type: '',
        description: '',
        amount: '',
        status: 'invoiced',
        due_date: '',
      }
    : undefined

  return (
    <>
      {showClient ? null : (
        <div className="flex justify-end">
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Log fee
          </Button>
        </div>
      )}

      {fees.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No fees logged"
          description="Track what you have billed and what has come in — the monthly view tells you where you stand."
          action={<Button onClick={() => setAddOpen(true)}>Log your first fee</Button>}
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>For</TableHead>
                {showClient && <TableHead className="hidden sm:table-cell">Client</TableHead>}
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden md:table-cell">Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fees.map((fee) => (
                <TableRow key={fee.id}>
                  <TableCell>
                    <span className="font-medium">{fee.description}</span>
                    {fee.service_type && (
                      <span className="block text-xs text-muted-foreground">
                        {serviceLabel(fee.service_type)}
                      </span>
                    )}
                  </TableCell>
                  {showClient && (
                    <TableCell className="hidden sm:table-cell">
                      <Link href={`/clients/${fee.client_id}`} className="hover:underline">
                        {fee.client_name}
                      </Link>
                    </TableCell>
                  )}
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatPaise(fee.amount_paise)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {formatDate(fee.due_date)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={fee.is_overdue ? 'overdue' : fee.status} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={isPending}
                            aria-label={`Actions for ${fee.description}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(fee)}>Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setStatus(fee, 'draft')}>
                          Mark draft
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setStatus(fee, 'invoiced')}>
                          Mark invoiced
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setStatus(fee, 'paid')}>
                          Mark paid
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => onDelete(fee)}>
                          <Trash2 className="size-4" aria-hidden />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FeeFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        clients={clients}
        defaultValues={addDefaults}
      />
      {editing && (
        <FeeFormDialog
          key={editing.id}
          open
          onOpenChange={(next) => !next && setEditing(null)}
          clients={clients}
          feeId={editing.id}
          defaultValues={toFormValues(editing)}
        />
      )}
    </>
  )
}

export function AddFeeButton({ clients }: { clients: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        Log fee
      </Button>
      <FeeFormDialog open={open} onOpenChange={setOpen} clients={clients} />
    </>
  )
}
