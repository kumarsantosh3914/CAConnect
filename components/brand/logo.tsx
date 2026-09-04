import { cn } from '@/lib/utils'

/**
 * The CAConnect mark: a filed sheet with a tick.
 *
 * Uses currentColor for the sheet so it inverts correctly on dark backgrounds,
 * and takes the tick from the surrounding surface.
 */
export function LogoMark({
  className,
  /**
   * Set to false when a visible wordmark sits beside the mark — otherwise
   * assistive tech announces "CAConnect CAConnect".
   */
  labelled = true,
}: {
  className?: string
  labelled?: boolean
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('size-6 shrink-0', className)}
      {...(labelled ? { role: 'img', 'aria-label': 'CAConnect' } : { 'aria-hidden': true })}
    >
      <rect width="32" height="32" rx="7" className="fill-foreground" />
      <path
        d="M10 7h8.5L23 11.5V25a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"
        className="fill-background"
      />
      <path d="M18.5 7 23 11.5h-4.5V7z" className="fill-muted-foreground" />
      <path
        d="m12.2 17.6 2.6 2.6 5-5.4"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-foreground"
      />
    </svg>
  )
}

export function Logo({
  className,
  markClassName,
}: {
  className?: string
  markClassName?: string
}) {
  return (
    <span className={cn('flex items-center gap-2 font-semibold tracking-tight', className)}>
      <LogoMark className={markClassName} labelled={false} />
      CAConnect
    </span>
  )
}
