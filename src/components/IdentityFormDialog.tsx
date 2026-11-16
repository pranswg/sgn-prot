import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type Accent = 'blue' | 'teal'

interface IdentityFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  icon: ReactNode
  accent?: Accent
  title: string
  description: ReactNode
  /** The identity rail. Omitted when the caller renders a single-column body. */
  rail?: ReactNode
  footerNote?: ReactNode
  footer?: ReactNode
  children: ReactNode
}

const ACCENT_STYLES: Record<Accent, string> = {
  blue: 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
  teal: 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300',
}

/**
 * The Add Member and Add Trainee window: a titled header over a quiet identity
 * rail and a scrolling form column with a footer that states the outcome. The
 * rail drops below `md`, where the caller's mobile body carries the same facts
 * inline (the trainee form stacks its sections instead).
 */
export function IdentityFormDialog({
  open,
  onOpenChange,
  icon,
  accent = 'blue',
  title,
  description,
  rail,
  footerNote,
  footer,
  children,
}: IdentityFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="flex-row items-center gap-3 border-b border-border/70 px-5 py-4 pr-12">
          <span
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-xl border',
              ACCENT_STYLES[accent],
            )}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <DialogTitle className="truncate text-base font-bold">
              {title}
            </DialogTitle>
            <DialogDescription className="truncate text-xs">
              {description}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex min-h-0">
          {rail ? (
            <aside className="hidden w-[236px] shrink-0 flex-col overflow-y-auto border-r border-border/70 bg-muted/30 p-5 md:flex">
              {rail}
            </aside>
          ) : null}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {children}
            </div>
            {footer ? (
              <div className="flex shrink-0 items-center gap-2 border-t border-border/70 px-5 py-3 sm:px-6">
                {footerNote ? (
                  <span className="hidden flex-1 text-xs text-muted-foreground sm:inline">
                    {footerNote}
                  </span>
                ) : null}
                {footer}
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
