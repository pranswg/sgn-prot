import { ChevronDown, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface DisclosureSectionProps {
  open: boolean
  onToggle: () => void
  icon?: LucideIcon
  title: ReactNode
  /**
   * Optional second line: what the section holds, or the one thing that still
   * blocks a save. It stays on screen while the section is closed, which is the
   * point of it.
   */
  summary?: ReactNode
  /** Row content between the summary and the chevron, such as a count. */
  trailing?: ReactNode
  /**
   * The body, rendered only while open. It brings its own padding; the section
   * supplies the border and nothing else, so the contents do not land in a
   * second card.
   */
  children: ReactNode
  className?: string
  bodyClassName?: string
}

/**
 * A collapsed section that is a single card: the trigger row and the body it
 * reveals share one border, so opening a row reads as the row unfolding rather
 * than a separate container appearing underneath. The chevron sits at the right
 * edge of the row, whichever width the section is given.
 *
 * `DisclosureButton` is the looser variant — a bare trigger whose body sits
 * outside it — kept for the screens that already lay out their own body.
 */
export function DisclosureSection({
  open,
  onToggle,
  icon: Icon,
  title,
  summary,
  trailing,
  children,
  className,
  bodyClassName,
}: DisclosureSectionProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm',
        className,
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-accent/50"
      >
        {Icon && (
          <Icon
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            {title}
          </span>
          {summary != null && (
            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
              {summary}
            </span>
          )}
        </span>
        {trailing}
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className={cn('border-t border-border/70', bodyClassName)}>
          {children}
        </div>
      )}
    </div>
  )
}
