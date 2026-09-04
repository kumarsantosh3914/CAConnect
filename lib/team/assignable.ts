/**
 * Plain module, deliberately not marked 'use client'.
 *
 * toAssignable() is called from Server Components (the deadlines, clients,
 * dashboard and client profile pages all build the picker options server-side).
 * It originally lived beside the AssigneeSelect component, which is a client
 * component — and a plain function exported from a 'use client' file cannot be
 * called from the server at all, only passed as a prop. That failed at runtime
 * with a 500, not at build time.
 */
export type AssignableMember = { userId: string; label: string }

export const UNASSIGNED = 'unassigned'

/** Turns team members into picker options, marking the current user. */
export function toAssignable(
  members: { userId: string; fullName: string | null; email: string | null }[],
  currentUserId?: string
): AssignableMember[] {
  return members.map((m) => ({
    userId: m.userId,
    label: (m.fullName || m.email || 'Unknown') + (m.userId === currentUserId ? ' (you)' : ''),
  }))
}
