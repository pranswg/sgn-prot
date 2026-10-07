import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  MEMBER_PAGE_SIZES,
  type MemberPage,
  type MemberPageSize,
} from '@/lib/memberDirectory'

/**
 * Page navigation for one choir section.
 *
 * Each section gets its own instance with its own page number, so the women's
 * and men's tables are paged independently. The page-size control is rendered
 * once by the parent instead of here, since one choice applies to both.
 */
export function SectionPaginator({
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
            of <span className="font-semibold text-foreground/80">{page.total}</span>{' '}
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

/** Shared page-size control. One choice applies to both choir sections. */
export function PageSizeControl({
  value,
  className,
  onChange,
}: {
  value: MemberPageSize
  className?: string
  onChange: (size: MemberPageSize) => void
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-[0.6875rem] text-muted-foreground">
        Rows to show
      </span>
      <div
        role="group"
        aria-label="Members per page"
        className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5"
      >
        {MEMBER_PAGE_SIZES.map((size) => (
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