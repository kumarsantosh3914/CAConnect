'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { X } from 'lucide-react'
import { SERVICE_TYPES } from '@/lib/validations/client'
import { serviceLabel } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { AssignableMember } from '@/lib/team/assignable'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ALL = 'all'

export function DeadlineFilters({
  clients,
  clientId,
  service,
  includeCompleted,
  assigned,
  members = [],
}: {
  clients: { id: string; name: string }[]
  clientId?: string
  service?: string
  includeCompleted: boolean
  assigned?: string
  members?: AssignableMember[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const clientItems: Record<string, string> = {
    [ALL]: 'All clients',
    ...Object.fromEntries(clients.map((c) => [c.id, c.name])),
  }
  const serviceItems: Record<string, string> = {
    [ALL]: 'All services',
    ...Object.fromEntries(SERVICE_TYPES.map((type) => [type, serviceLabel(type)])),
  }

  function apply(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === ALL) params.delete(key)
      else params.set(key, value)
    }
    const query = params.toString()
    startTransition(() => router.replace(query ? `/deadlines?${query}` : '/deadlines'))
  }

  const hasFilters = Boolean(clientId || service || includeCompleted || assigned)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        items={clientItems}
        value={clientId ?? ALL}
        onValueChange={(next) => apply({ client: next as string })}
      >
        <SelectTrigger className="w-52" aria-label="Filter by client">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All clients</SelectItem>
          {clients.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              {client.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={serviceItems}
        value={service ?? ALL}
        onValueChange={(next) => apply({ service: next as string })}
      >
        <SelectTrigger className="w-44" aria-label="Filter by service">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All services</SelectItem>
          {SERVICE_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {serviceLabel(type)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {members.length > 1 && (
        <Select
          items={{
            [ALL]: 'Anyone',
            unassigned: 'Unassigned',
            ...Object.fromEntries(members.map((m) => [m.userId, m.label])),
          }}
          value={assigned ?? ALL}
          onValueChange={(next) => apply({ assigned: (next as string) ?? ALL })}
        >
          <SelectTrigger className="w-44" aria-label="Filter by assignee">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Anyone</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
        <Checkbox
          checked={includeCompleted}
          onCheckedChange={(checked) => apply({ completed: checked ? '1' : undefined })}
        />
        Show filed
      </label>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.replace('/deadlines')}>
          <X className="size-4" aria-hidden />
          Clear
        </Button>
      )}
    </div>
  )
}
