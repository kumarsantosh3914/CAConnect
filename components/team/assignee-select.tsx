'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UNASSIGNED, type AssignableMember } from '@/lib/team/assignable'

/** Shared assignee picker, so clients and deadlines read the same way. */
export function AssigneeSelect({
  id,
  members,
  value,
  onChange,
  includeUnassigned = true,
  unassignedLabel = 'Unassigned',
  className,
  ariaLabel,
}: {
  id?: string
  members: AssignableMember[]
  /** '' or 'unassigned' both mean nobody. */
  value: string
  onChange: (next: string) => void
  includeUnassigned?: boolean
  unassignedLabel?: string
  className?: string
  ariaLabel?: string
}) {
  const items: Record<string, string> = {
    ...(includeUnassigned ? { [UNASSIGNED]: unassignedLabel } : {}),
    ...Object.fromEntries(members.map((m) => [m.userId, m.label])),
  }

  return (
    <Select
      items={items}
      value={value || UNASSIGNED}
      onValueChange={(next) => onChange((next as string) ?? UNASSIGNED)}
    >
      <SelectTrigger id={id} className={className} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {includeUnassigned && <SelectItem value={UNASSIGNED}>{unassignedLabel}</SelectItem>}
        {members.map((m) => (
          <SelectItem key={m.userId} value={m.userId}>
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

