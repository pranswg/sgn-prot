import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Tint for a field's icon badge. Pastel in light mode, a translucent wash in
 * dark mode. The tint is decoration only: a field is always identified by its
 * label, never by the badge colour.
 */
export type FieldCardTone =
  | 'violet'
  | 'rose'
  | 'amber'
  | 'sky'
  | 'emerald'
  | 'slate'

const TONE_CLASSES: Record<FieldCardTone, string> = {
  violet:
    'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  amber:
    'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  emerald:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  slate: 'bg-muted text-muted-foreground',
}

interface FieldCardProps {
  icon: LucideIcon
  label: ReactNode
  /** Appends the red required marker to the label. */
  required?: boolean
  tone?: FieldCardTone
  /** The control, and any hint under it. */
  children: ReactNode
  className?: string
}

/**
 * One labelled field: a tinted icon badge, the label (with an optional required
 * marker), then the control beneath it stretched to the card's width. Pair these
 * inside a `FieldCardGroup` to build a column of fields.
 */
export function FieldCard({
  icon: Icon,
  label,
  required = false,
  tone = 'sky',
  children,
  className,
}: FieldCardProps) {
  return (
    <div className={cn('flex flex-col gap-2 px-4 py-4', className)}>
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            TONE_CLASSES[tone],
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold text-foreground">
          {label}
          {required && (
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </span>
      </div>
      {children}
    </div>
  )
}

/**
 * A column of `FieldCard`s separated by hairline dividers, with no card chrome
 * of its own. Use it inside a container that already draws the border — a
 * `DisclosureSection` body, for instance — so the fields do not sit in a second
 * card.
 */
export function FieldCardList({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex flex-col divide-y divide-border/70', className)}>
      {children}
    </div>
  )
}

/**
 * The bordered card that holds one column of `FieldCard`s. Standalone on the
 * page: the host does not wrap the form in a second card of its own.
 */
export function FieldCardGroup({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm',
        className,
      )}
    >
      <FieldCardList>{children}</FieldCardList>
    </div>
  )
}
