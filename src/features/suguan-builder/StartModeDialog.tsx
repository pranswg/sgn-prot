import { useMemo, useState } from 'react'
import { CalendarPlus, Copy, Sparkles, Users } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDate } from '@/lib/format'
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
  const [query, setQuery] = useState('')

  const recent = useMemo(
    () =>
      [...suguan]
        .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
        .slice(0, 40),
    [suguan],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return recent
    return recent.filter((s) =>
      `${serviceTypeLabel(s)} ${groupLabel(s.group)} ${s.date}`
        .toLowerCase()
        .includes(q),
    )
  }, [query, recent])

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
