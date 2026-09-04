'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Search, X } from 'lucide-react'
import { SERVICE_TYPES } from '@/lib/validations/client'
import { serviceLabel } from '@/lib/format'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { AssignableMember } from '@/lib/team/assignable'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ALL = 'all'

// Base UI renders the raw value in the trigger unless Root gets an items map.
const SERVICE_ITEMS: Record<string, string> = {
  [ALL]: 'All services',
  ...Object.fromEntries(SERVICE_TYPES.map((type) => [type, serviceLabel(type)])),
}

export function ClientFilters({
  search,
  service,
  assigned,
  members = [],
}: {
  search?: string
  service?: string
  assigned?: string
  members?: AssignableMember[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [value, setValue] = useState(search ?? '')

  // Keep the box in step when the URL changes from elsewhere (back button,
  // "clear filters"), without fighting the user mid-type. Adjusting during
  // render is React's documented pattern here — an effect would cascade.
  const [lastSearch, setLastSearch] = useState(search)
  if (search !== lastSearch) {
    setLastSearch(search)
    setValue(search ?? '')
  }

  function apply(next: { q?: string; service?: string; assigned?: string }) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, val] of Object.entries(next)) {
      if (!val || val === ALL) params.delete(key)
      else params.set(key, val)
    }
    const query = params.toString()
    startTransition(() => router.replace(query ? `/clients?${query}` : '/clients'))
  }

  // Debounce so a 40-client firm is not refetched on every keystroke.
  useEffect(() => {
    const current = search ?? ''
    if (value === current) return
    const timer = setTimeout(() => apply({ q: value }), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const hasFilters = Boolean(search || service || assigned)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-56 flex-1">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search by name, PAN or GSTIN"
          className="pl-8"
          aria-label="Search clients"
        />
      </div>

      <Select
        items={SERVICE_ITEMS}
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

      {/*
        Three states, not two: no filter at all, nobody assigned, or one
        person. The shared AssigneeSelect only distinguishes the last two, so
        the filter spells its options out.
      */}
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
          <SelectTrigger className="w-44" aria-label="Filter by who handles the client">
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

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.replace('/clients')}>
          <X className="size-4" aria-hidden />
          Clear
        </Button>
      )}
    </div>
  )
}
