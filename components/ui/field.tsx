import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * Minimal labelled-field wrapper.
 *
 * This shadcn style ships no `form` component (it is Base UI, not Radix), so
 * forms use react-hook-form directly and this handles the label / error /
 * hint layout that would otherwise be repeated on every input.
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  warning,
  required,
  className,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  /** Advisory text — shown only when there is no hard error. */
  hint?: string
  /** Softer than an error: the value is accepted but looks wrong. */
  warning?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : warning ? (
        <p className="text-sm text-amber-600 dark:text-amber-500">{warning}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
