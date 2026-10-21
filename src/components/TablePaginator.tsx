import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MemberPage } from '@/lib/memberDirectory'

/**
 * Page navigation for one table or card list.
 *
 * The caller passes the already-sliced page (`paginate` result) and moves the
 * page number itself, so each table keeps its own independent position and this
 * stays a dumb renderer. The label is what the count reads out, e.g. "Showing
 * 1-10 of 42 log entries".
 *
 * The Master List's `SectionPaginator` is the member-directory-specific twin of
 * this; it hardcodes member wording and lives under `features/master-list/`, so
 * a feature outside that folder shares this one instead.
 */
export function TablePaginator({
  label,
  page,
  className,
  onPageChange,
}: {
  label: string
  page: MemberPage<unknown>
  className?: string
  onPageChange: (page: number) => void
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-2.5',
        className,
      )}
    >
      <p className="text-[0.6875rem] tabular-nums text-muted-foreground">
        {page.total > 0 ? (
          <>
            Showing{' '}
            <span className="font-semibold text-foreground/80">
              {page.firstItem}&ndash;{page.lastItem}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-foreground/80">
              {page.total}
            </span>{' '}
            {label}
          </>
        ) : (
          `No ${label.toLowerCase()}`
        )}
      </p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page.page - 1)}
          disabled={!page.hasPrevious}
          aria-label={`Previous page of ${label}`}
          className={cn(
            'inline-flex size-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors',
            'hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
          )}
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="px-1 text-[0.6875rem] tabular-nums text-muted-foreground">
          Page {page.page} of {page.pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page.page + 1)}
          disabled={!page.hasNext}
          aria-label={`Next page of ${label}`}
          className={cn(
            'inline-flex size-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors',
            'hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
          )}
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

/**
 * Page-size control. The sizes are passed in because the Administration tables
 * offer a wider scale than the member directory.
 */
export function TablePageSizeControl({
  value,
  sizes,
  label,
  className,
  onChange,
}: {
  value: number
  sizes: readonly number[]
  label: string
  className?: string
  onChange: (size: number) => void
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-[0.6875rem] text-muted-foreground">
        Rows to show
      </span>
      <div
        role="group"
        aria-label={label}
        className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5"
      >
        {sizes.map((size) => (
          <button
            key={size}
            type="button"
            aria-pressed={value === size}
            onClick={() => onChange(size)}
            className={cn(
              'h-7 min-w-8 rounded-md px-2 text-xs font-medium tabular-nums transition-colors',
              value === size
                ? 'bg-brand-navy-soft text-brand-navy'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  )
}
