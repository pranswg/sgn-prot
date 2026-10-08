import { useState } from 'react'
import { Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import type { WorshipSchedule } from '@/core/constants/worshipSchedules'
import { worshipDayName } from '@/core/constants/worshipSchedules'
import { useWorshipScheduleCategories } from '@/store/worshipScheduleStore'
import { categoryLabel, type WorshipScheduleCategory } from './organistaSuguanService'

export interface SelectedWorshipSchedule {
  schedule: WorshipSchedule
  category: WorshipScheduleCategory
}

interface SchedulePickerProps {
  open: boolean
  confirmLabel: string
  /**
   * Schedules already on the sheet, so the user cannot add the same service
   * twice from the picker (duplication is a card action instead).
   */
  takenScheduleIds?: ReadonlySet<string>
  /** Highlight the schedule currently on the card being changed. */
  currentScheduleId?: string | null
  onClose: () => void
  onConfirm: (selection: SelectedWorshipSchedule) => void
}

/**
 * The "Select Worship Schedule" picker. Rows come straight from the live
 * Worship Service Schedule Settings (active schedules only), grouped into
 * Midweek and Weekend. It never offers a free-text title — the schedule itself
 * is the source of truth. Shown as a dialog on desktop and a bottom sheet on
 * mobile.
 */
export function SchedulePicker({
  open,
  confirmLabel,
  takenScheduleIds,
  currentScheduleId,
  onClose,
  onConfirm,
}: SchedulePickerProps) {
  const isMobile = useIsMobile()
  const { midweek, weekend } = useWorshipScheduleCategories()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(
    currentScheduleId ?? null,
  )

  const groups: {
    category: WorshipScheduleCategory
    schedules: readonly WorshipSchedule[]
  }[] = [
    { category: 'midweek', schedules: midweek },
    { category: 'weekend', schedules: weekend },
  ]

  const matches = (schedule: WorshipSchedule) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const haystack = [
      worshipDayName(schedule.weekday),
      schedule.scheduleTime,
      schedule.label,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  }

  const select = (id: string) => setSelectedId(id)

  const selected = groups
    .flatMap((group) =>
      group.schedules.map((schedule) => ({ ...group, schedule })),
    )
    .find((entry) => entry.schedule.id === selectedId)

  const taken = takenScheduleIds ?? new Set<string>()

  const handleConfirm = () => {
    if (!selected) return
    onConfirm(selected)
  }

  const body = (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="relative shrink-0">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search schedules…"
          className="pl-9"
          aria-label="Search worship schedules"
        />
      </div>
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
        {groups.map((group) => {
          const list = group.schedules.filter(matches)
          if (list.length === 0) return null
          return (
            <div key={group.category}>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {group.category === 'midweek' ? 'Midweek' : 'Weekend'}
              </p>
              <div className="flex flex-col gap-1.5">
                {list.map((schedule) => {
                  const id = schedule.id
                  const alreadyTaken = taken.has(id) && id !== currentScheduleId
                  const isSelected = id === selectedId
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={alreadyTaken}
                      onClick={() => select(id)}
                      className={cn(
                        'pressable flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-left motion-reduce:transform-none',
                        isSelected &&
                          'border-primary bg-primary/5 ring-1 ring-primary',
                        alreadyTaken && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {worshipDayName(schedule.weekday)}
                        </span>
                        <span className="block truncate text-sm text-muted-foreground">
                          {schedule.scheduleTime}
                        </span>
                      </span>
                      {alreadyTaken ? (
                        <span className="shrink-0 text-xs font-medium text-muted-foreground">
                          Added
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'flex size-5 shrink-0 items-center justify-center rounded-full border',
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border',
                          )}
                        >
                          {isSelected && <Check className="size-3.5" />}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
        {groups.every((group) => group.schedules.length === 0) && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No active worship schedules. Add them in Settings → Worship Service
            Schedule Settings.
          </p>
        )}
      </div>
    </div>
  )

  const footerButton = (
    <Button
      className={cn('min-h-11 flex-1', !selected && 'pointer-events-none opacity-50')}
      onClick={handleConfirm}
    >
      {confirmLabel}
    </Button>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] gap-0 rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-border" />
          <SheetHeader className="border-b border-border/70 pr-14">
            <SheetTitle>Select Worship Schedule</SheetTitle>
            <p className="text-sm text-muted-foreground">
              {categoryLabel('midweek')} and {categoryLabel('weekend').toLowerCase()}{' '}
              from the schedule settings.
            </p>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{body}</div>
          <div className="border-t border-border/70 px-4 pt-3">
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="min-h-11 flex-1"
                onClick={onClose}
              >
                Cancel
              </Button>
              {footerButton}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Worship Schedule</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {categoryLabel('midweek')} and {categoryLabel('weekend').toLowerCase()}{' '}
            from the schedule settings.
          </p>
        </DialogHeader>
        <div className="max-h-[60vh]">{body}</div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {footerButton}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}