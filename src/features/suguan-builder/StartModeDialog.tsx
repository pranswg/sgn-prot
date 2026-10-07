import { useMemo, useState } from 'react'
import {
  CalendarPlus,
  Copy,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { planEventsFromCoverage } from '@/lib/suguanDates'
import {
  coverageLabel,
  groupLabel,
  serviceTypeLabel,
  totalAssignedCount,
} from '@/lib/suguanUtils'
import type { Suguan } from '@/core/types/suguan'

interface StartModeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  suguan: Suguan[]
  onStartNew: () => void
  onCopy: (source: Suguan) => void
}

export function StartModeDialog({
  open,
  onOpenChange,
  suguan,
  onStartNew,
  onCopy,
}: StartModeDialogProps) {
  const isMobile = useIsMobile()
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'new' | 'copy'>('new')

  const recent = useMemo(() => {
    const consumed = new Set<string>()
    for (const s of suguan) if (s.copiedFromId) consumed.add(s.copiedFromId)
    return [...suguan]
      .filter((s) => !consumed.has(s.id))
      .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
      .slice(0, 40)
  }, [suguan])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return recent
    return recent.filter((s) =>
      `${serviceTypeLabel(s)} ${groupLabel(s.group)} ${s.date}`
        .toLowerCase()
        .includes(q),
    )
  }, [query, recent])

  const untilLabel = (s: Suguan) => {
    if (!s.coverage) return null
    const events = planEventsFromCoverage(s.coverage)
    const last = events[events.length - 1]
    if (!last) return null
    return `until ${formatDate(last.endDate ?? last.date)}`
  }

  if (isMobile) {
    return (
      <Sheet
        open={open}
        onOpenChange={(o) => {
          if (o) setMode('new')
          onOpenChange(o)
        }}
      >
        <SheetContent
          side="bottom"
          showCloseButton={false}
          overlayClassName="bg-black/60 backdrop-blur-sm"
          className="h-[88dvh]! gap-0 rounded-t-[28px] border-t border-border bg-background p-0 text-foreground shadow-[0_-12px_40px_rgba(0,0,0,0.35)]"
        >
          {/* Drag handle + close */}
          <div className="relative shrink-0 px-5 pt-3">
            <span className="mx-auto block h-1 w-10 rounded-full bg-border" />
            <button
              type="button"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
              className="absolute right-4 top-3 flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 pt-2 pb-4">
            {/* Header */}
            <div className="shrink-0">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                How do you want to start?
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Build a blank Suguan, or copy a previous one and keep its
                schedules, rosters, duty roles, and document setup.
              </p>
            </div>

            {/* Start options */}
            <div className="flex shrink-0 flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  setMode('new')
                  onStartNew()
                }}
                className={cn(
                  'flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition-all',
                  mode === 'new'
                    ? 'border-primary bg-primary/10 shadow-[0_0_24px_rgba(37,99,235,0.25)] ring-1 ring-primary/50'
                    : 'border-border bg-card',
                )}
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_4px_12px_rgba(37,99,235,0.4)]">
                  <CalendarPlus className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-semibold text-foreground">
                    Start New Suguan
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Blank coverage, schedules, and roster.
                  </span>
                </span>
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    mode === 'new'
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground',
                  )}
                >
                  {mode === 'new' && (
                    <span className="size-1.5 rounded-full bg-primary-foreground" />
                  )}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMode('copy')}
                className={cn(
                  'flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition-all',
                  mode === 'copy'
                    ? 'border-primary bg-primary/10 shadow-[0_0_24px_rgba(37,99,235,0.25)] ring-1 ring-primary/50'
                    : 'border-dashed border-border bg-card/60',
                )}
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
                  <Copy className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-semibold text-foreground">
                    Copy Previous Suguan
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Pick one below to reuse everything except the dates.
                  </span>
                </span>
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    mode === 'copy'
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground',
                  )}
                >
                  {mode === 'copy' && (
                    <span className="size-1.5 rounded-full bg-primary-foreground" />
                  )}
                </span>
              </button>
            </div>

            {/* Previous Suguan */}
            <div className="flex min-h-0 flex-1 flex-col gap-2.5">
              <p className="shrink-0 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Previous Suguan
              </p>

              <div className="relative shrink-0">
                <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search previous Suguan..."
                  className="h-11 rounded-xl border-input bg-card pl-10 text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/40"
                />
              </div>

              <div className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-2">
                <div className="flex flex-col gap-2.5">
                  {recent.length === 0 ? (
                    <p className="flex items-center gap-2 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                      <Sparkles className="size-4 shrink-0" />
                      No previous Suguan to copy yet. Start new to build your
                      first one.
                    </p>
                  ) : filtered.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No matching Suguan found.
                    </p>
                  ) : (
                    filtered.map((s) => {
                      const until = untilLabel(s)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setMode('copy')
                            onCopy(s)
                          }}
                          className="w-full rounded-2xl border border-border bg-card p-3.5 text-left transition-colors active:bg-muted/60"
                        >
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-foreground">
                              {serviceTypeLabel(s)}
                            </span>
                            <span className="shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-wide text-muted-foreground uppercase">
                              {groupLabel(s.group)}
                            </span>
                          </span>
                          <span className="mt-2 flex items-end justify-between gap-3">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs text-muted-foreground">
                                {formatDate(s.date)} ·{' '}
                                {s.coverage
                                  ? coverageLabel(s.coverage)
                                  : '—'}
                              </span>
                              {until && (
                                <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground/70">
                                  {until}
                                </span>
                              )}
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[0.6875rem] font-semibold text-primary">
                                <Users className="size-3" />
                                {totalAssignedCount(s)}
                              </span>
                              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_12px_rgba(37,99,235,0.4)]">
                                <Copy className="size-3.5" />
                              </span>
                            </span>
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom action */}
          <div className="shrink-0 border-t border-border px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <Button
              onClick={() => onOpenChange(false)}
              className="h-12 w-full rounded-full border border-border bg-card text-base text-foreground shadow-sm hover:bg-muted hover:text-foreground"
            >
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>How do you want to start?</DialogTitle>
          <DialogDescription>
            Build a blank Suguan, or copy a previous one and keep its schedules,
            rosters, duty roles, and document setup.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onStartNew}
            className="flex flex-col items-start gap-1.5 rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-accent"
          >
            <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <CalendarPlus className="size-4" />
            </span>
            <span className="text-sm font-semibold">Start New Suguan</span>
            <span className="text-xs text-muted-foreground">
              Blank coverage, schedules, and roster.
            </span>
          </button>
          <div className="flex flex-col items-start gap-1.5 rounded-lg border border-dashed p-4 text-muted-foreground">
            <span className="flex size-9 items-center justify-center rounded-md bg-muted">
              <Copy className="size-4" />
            </span>
            <span className="text-sm font-semibold">Copy Previous Suguan</span>
            <span className="text-xs">
              Pick one below to reuse everything except the dates.
            </span>
          </div>
        </div>

        {recent.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search previous Suguan…"
              />
            </div>
            <ScrollArea className="max-h-64 rounded-md border">
              <div className="flex flex-col gap-1 p-2">
                {filtered.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No matching Suguan found.
                  </p>
                )}
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onCopy(s)}
                    className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {serviceTypeLabel(s)}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {groupLabel(s.group)}
                        </span>
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {formatDate(s.date)} ·{' '}
                        {s.coverage ? coverageLabel(s.coverage) : '—'}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline" className="gap-1">
                        <Users className="size-3" />
                        {totalAssignedCount(s)}
                      </Badge>
                      <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Copy className="size-3.5" />
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <Sparkles className="size-4" />
            No previous Suguan to copy yet. Start new to build your first one.
          </p>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
