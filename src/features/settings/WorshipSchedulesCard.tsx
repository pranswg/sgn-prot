import { useMemo, useState } from 'react'
import {
  ChevronDown,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/format'
import {
  WEEKDAY_OPTIONS,
  worshipDayName,
} from '@/core/constants/worshipSchedules'
import {
  useWorshipScheduleStore,
  type StoredWorshipSchedule,
  type WorshipScheduleCategory,
} from '@/store/worshipScheduleStore'

interface WorshipSchedulesCardProps {
  onAudit?: (action: string, details: string) => void
}

/** A `7:00 PM` display value back into `19:00` for the time input. */
function timeTo24(value: string): string {
  const match = value.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if (!match) return ''
  let hour = Number(match[1])
  const minutes = match[2] ?? '00'
  const period = match[3].toUpperCase()
  if (period === 'PM' && hour < 12) hour += 12
  if (period === 'AM' && hour === 12) hour = 0
  return `${String(hour).padStart(2, '0')}:${minutes}`
}

const dayName = (weekday: number): string =>
  WEEKDAY_OPTIONS.find((d) => d.weekday === weekday)?.name ?? ''

const scheduleLabel = (weekday: number, time24: string): string =>
  `${dayName(weekday)}, ${formatTime(time24)}`

interface TimeFormState {
  open: boolean
  category: WorshipScheduleCategory
  editingId: string | null
  weekday: number
  time24: string
  /** The editable display label, e.g. “Miyerkules 7:00 PM”. */
  label: string
  /** True once the user edited the label, so day/time changes stop overriding it. */
  customLabel: boolean
}

export function WorshipSchedulesCard({ onAudit }: WorshipSchedulesCardProps) {
  const isMobile = useIsMobile()
  const storedMidweek = useWorshipScheduleStore((s) => s.midweek)
  const storedWeekend = useWorshipScheduleStore((s) => s.weekend)
  const setSchedules = useWorshipScheduleStore((s) => s.setSchedules)

  const [expanded, setExpanded] = useState(false)
  const [midweek, setMidweek] = useState<StoredWorshipSchedule[]>(storedMidweek)
  const [weekend, setWeekend] = useState<StoredWorshipSchedule[]>(storedWeekend)
  const [dirty, setDirty] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(true)
  const [form, setForm] = useState<TimeFormState | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{
    category: WorshipScheduleCategory
    item: StoredWorshipSchedule
  } | null>(null)

  const activeCount = useMemo(
    () =>
      midweek.filter((s) => !s.disabled).length +
      weekend.filter((s) => !s.disabled).length,
    [midweek, weekend],
  )

  const openCard = () => {
    setExpanded((open) => {
      const next = !open
      // Refreshes the draft from the store the first time the card is opened,
      // so an import or a previous save is visible without a page reload.
      if (next && !dirty) {
        setMidweek(storedMidweek)
        setWeekend(storedWeekend)
      }
      return next
    })
  }

  const save = () => {
    setSchedules(midweek, weekend)
    setDirty(false)
    toast.success('Worship schedules saved.')
    onAudit?.(
      'Updated Worship Schedules',
      `${activeCount} active schedules (${midweek.length} midweek, ${weekend.length} weekend).`,
    )
  }

  const cancel = () => {
    setMidweek(storedMidweek)
    setWeekend(storedWeekend)
    setDirty(false)
  }

  const items = (category: WorshipScheduleCategory) =>
    category === 'midweek' ? midweek : weekend

  const setList = (
    category: WorshipScheduleCategory,
    list: StoredWorshipSchedule[],
  ) => {
    if (category === 'midweek') setMidweek(list)
    else setWeekend(list)
    setDirty(true)
  }

  const updateItem = (
    category: WorshipScheduleCategory,
    id: string,
    patchIt: (item: StoredWorshipSchedule) => StoredWorshipSchedule,
  ) => {
    setList(
      category,
      items(category).map((item) => (item.id === id ? patchIt(item) : item)),
    )
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    setList(
      pendingDelete.category,
      items(pendingDelete.category).filter((i) => i.id !== pendingDelete.item.id),
    )
    setPendingDelete(null)
    toast.success('Worship schedule removed.')
  }

  const duplicateIn = (
    category: WorshipScheduleCategory,
    weekday: number,
    time24: string,
    skipId?: string,
  ) =>
    items(category).some(
      (item) =>
        item.id !== skipId &&
        item.weekday === weekday &&
        timeTo24(item.scheduleTime) === time24,
    )

  const openAdd = (category: WorshipScheduleCategory) => {
    const weekday = category === 'midweek' ? 3 : 6
    const time24 = '19:00'
    setForm({
      open: true,
      category,
      editingId: null,
      weekday,
      time24,
      label: scheduleLabel(weekday, time24),
      customLabel: false,
    })
  }

  const openEdit = (category: WorshipScheduleCategory, item: StoredWorshipSchedule) => {
    const time24 = timeTo24(item.scheduleTime)
    setForm({
      open: true,
      category,
      editingId: item.id,
      weekday: item.weekday,
      time24,
      label: item.label,
      customLabel: item.label !== scheduleLabel(item.weekday, time24),
    })
  }

  const saveForm = () => {
    if (!form) return
    const time24 = form.time24 || ''
    if (!time24) {
      toast.error('Pick a time first.')
      return
    }
    if (duplicateIn(form.category, form.weekday, time24, form.editingId ?? undefined)) {
      toast.error('A schedule at that day and time already exists.')
      return
    }
    const displayTime = formatTime(time24)
    const suggested = `${dayName(form.weekday)}, ${displayTime}`
    const label = form.label.trim() || suggested
    const scheduleDay = worshipDayName(form.weekday).toUpperCase()

    if (form.editingId) {
      updateItem(form.category, form.editingId, (item) => ({
        ...item,
        weekday: form.weekday,
        scheduleDay,
        scheduleTime: displayTime,
        label,
      }))
    } else {
      const record: StoredWorshipSchedule = {
        id: `custom-${form.weekday}-${time24.replace(':', '')}`,
        weekday: form.weekday,
        scheduleDay,
        scheduleTime: displayTime,
        label,
        presetHint: '',
        custom: true,
      }
      setList(form.category, [...items(form.category), record])
    }
    setForm(null)
  }

  const renderScheduleGroup = (category: WorshipScheduleCategory) => {
    const list = items(category)
    if (list.length === 0) {
      return (
        <p className="py-3 text-center text-sm text-muted-foreground">
          No {category} schedules yet.
        </p>
      )
    }
    const byDay = new Map<number, StoredWorshipSchedule[]>()
    for (const item of list) {
      const bucket = byDay.get(item.weekday) ?? []
      bucket.push(item)
      byDay.set(item.weekday, bucket)
    }
    const order = [...byDay.keys()].sort((a, b) => a - b)
    return (
      <ul className="divide-y divide-border/60">
        {order.map((weekday) => (
          <li key={weekday} className="py-2.5">
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {dayName(weekday)}
            </p>
            <div className="flex flex-col gap-1.5">
              {(byDay.get(weekday) ?? []).map((item) => (
                <ScheduleRow
                  key={item.id}
                  item={item}
                  isMobile={isMobile}
                  onEdit={() => openEdit(category, item)}
                  onToggle={() =>
                    updateItem(category, item.id, (next) => ({
                      ...next,
                      disabled: !next.disabled,
                    }))
                  }
                  onRemove={() => setPendingDelete({ category, item })}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
    )
  }

  const renderPreview = () => (
    <div className="mt-1 flex flex-col gap-3">
      {(['midweek', 'weekend'] as const).map((category) => {
        const list = items(category)
        if (list.length === 0) return null
        return (
          <div key={category}>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {category}
            </p>
            <ul className="flex flex-col gap-1">
              {list.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={cn(
                      'min-w-0 flex-1',
                      item.disabled && 'text-muted-foreground line-through',
                    )}
                  >
                    {item.label}
                  </span>
                  {item.disabled && !isMobile && (
                    <Badge variant="outline" className="shrink-0 text-xs">
                      Disabled
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )

  return (
    <section className="flex flex-col gap-2">
      <Card>
        <CardHeader>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={openCard}
            className="flex min-w-0 items-start gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base leading-snug font-medium text-foreground">
                Worship Schedules
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                Set the midweek and weekend worship times that Suguan planning uses.
              </span>
            </span>
            <ChevronDown
              className={cn(
                'mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                expanded && 'rotate-180',
              )}
            />
          </button>
          <CardAction>
            <Badge
              variant={dirty ? 'default' : 'outline'}
              className={cn('text-xs', dirty && 'bg-amber-500 text-white')}
            >
              {dirty ? 'Unsaved changes' : `${activeCount} active`}
            </Badge>
          </CardAction>
        </CardHeader>

        {expanded && (
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 rounded-lg border border-border/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Midweek worship</p>
                <Button
                  size={isMobile ? 'icon-sm' : 'sm'}
                  variant="outline"
                  aria-label="Add midweek schedule time"
                  onClick={() => openAdd('midweek')}
                >
                  <Plus className={cn(isMobile ? 'size-4' : 'size-3.5')} />
                  {!isMobile && 'Add time'}
                </Button>
              </div>
              {renderScheduleGroup('midweek')}
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-border/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Weekend worship</p>
                <Button
                  size={isMobile ? 'icon-sm' : 'sm'}
                  variant="outline"
                  aria-label="Add weekend schedule time"
                  onClick={() => openAdd('weekend')}
                >
                  <Plus className={cn(isMobile ? 'size-4' : 'size-3.5')} />
                  {!isMobile && 'Add time'}
                </Button>
              </div>
              {renderScheduleGroup('weekend')}
            </div>

            <div className="overflow-hidden rounded-lg border border-border/70">
              <button
                type="button"
                onClick={() => setPreviewOpen((open) => !open)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {previewOpen ? (
                  <Eye className="size-4 text-muted-foreground" />
                ) : (
                  <EyeOff className="size-4 text-muted-foreground" />
                )}
                <span className="text-sm font-semibold">Schedule preview</span>
                <ChevronDown
                  className={cn(
                    'ml-auto size-4 text-muted-foreground transition-transform duration-200',
                    previewOpen && 'rotate-180',
                  )}
                />
              </button>
              {previewOpen && (
                <div className="border-t border-border/70 px-3 py-3">{renderPreview()}</div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {expanded && (
        <div className="sticky bottom-0 z-10 -mx-4 px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:relative md:bottom-auto md:z-auto md:mx-0 md:p-0">
          <div className="flex flex-row gap-3 rounded-xl border bg-background/95 p-2 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] backdrop-blur md:flex-row md:justify-end md:gap-2 md:border-0 md:bg-transparent md:shadow-none md:p-0">
            <Button
              variant="outline"
              className="min-h-11 flex-1 md:min-h-0 md:flex-none"
              onClick={cancel}
              disabled={!dirty}
            >
              Cancel
            </Button>
            <Button
              className="min-h-11 flex-1 md:min-h-0 md:flex-none"
              onClick={save}
              disabled={!dirty}
            >
              Save Changes
            </Button>
          </div>
        </div>
      )}

      {form && (
        <TimeForm
          form={form}
          isMobile={isMobile}
          onClose={() => setForm(null)}
          onPatch={(patch) => setForm((f) => (f ? { ...f, ...patch } : f))}
          onSave={saveForm}
        />
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove worship schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `“${pendingDelete.item.label}” will no longer be suggested for new Suguans. Saved Suguans are not changed.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white"
              onClick={confirmDelete}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

function ScheduleRow({
  item,
  isMobile,
  onEdit,
  onToggle,
  onRemove,
}: {
  item: StoredWorshipSchedule
  isMobile: boolean
  onEdit: () => void
  onToggle: () => void
  onRemove: () => void
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5',
        item.disabled && 'opacity-70',
      )}
    >
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm font-medium',
            item.disabled && 'text-muted-foreground line-through',
          )}
        >
          {item.label}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {item.scheduleTime}
          {item.disabled ? ' · disabled' : ''}
          {!item.custom ? ' · standard' : ''}
        </p>
      </div>
      {isMobile ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="Schedule actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggle}>
              <Power className="size-4" />
              {item.disabled ? 'Enable' : 'Disable'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={onRemove}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <>
          <Button size="icon-sm" variant="ghost" aria-label="Edit schedule time" onClick={onEdit}>
            <Pencil className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={item.disabled ? 'Enable schedule time' : 'Disable schedule time'}
            onClick={onToggle}
          >
            <Power
              className={cn('size-4', item.disabled && 'text-muted-foreground')}
            />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Remove schedule time" onClick={onRemove}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </>
      )}
    </div>
  )
}

function TimeForm({
  form,
  isMobile,
  onClose,
  onPatch,
  onSave,
}: {
  form: TimeFormState
  isMobile: boolean
  onClose: () => void
  onPatch: (
    patch: Partial<
      Pick<TimeFormState, 'weekday' | 'time24' | 'label' | 'customLabel'>
    >,
  ) => void
  onSave: () => void
}) {
  const editing = form.editingId !== null
  const suggested = scheduleLabel(form.weekday, form.time24)

  const pickDay = (weekday: number) =>
    onPatch(
      form.customLabel
        ? { weekday }
        : { weekday, label: scheduleLabel(weekday, form.time24) },
    )

  const pickTime = (time24: string) =>
    onPatch(
      form.customLabel
        ? { time24 }
        : { time24, label: scheduleLabel(form.weekday, time24) },
    )

  const pickLabel = (label: string) => onPatch({ label, customLabel: true })

  const body = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>Day</Label>
        <div className="grid grid-cols-4 gap-2">
          {WEEKDAY_OPTIONS.map((day) => (
            <button
              key={day.weekday}
              type="button"
              onClick={() => pickDay(day.weekday)}
              className={cn(
                'rounded-md border px-2 py-2.5 text-center text-sm transition-colors',
                form.weekday === day.weekday
                  ? 'border-primary bg-primary/5 font-medium text-primary ring-1 ring-primary'
                  : 'border-border text-foreground hover:border-primary/50',
              )}
            >
              {day.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="schedule-time">Time</Label>
        <Input
          id="schedule-time"
          type="time"
          value={form.time24}
          onChange={(e) => pickTime(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="schedule-label">Label</Label>
        <Input
          id="schedule-label"
          value={form.label}
          onChange={(e) => pickLabel(e.target.value)}
          placeholder={suggested}
        />
        <p className="text-xs text-muted-foreground">
          This is the name shown on the Organist Suguan sheet. Leave it blank to
          use “{suggested}”.
        </p>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] gap-0 rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-border" />
          <SheetHeader className="border-b border-border/70 pr-14">
            <SheetTitle>
              {editing ? 'Edit schedule time' : 'Add worship schedule time'}
            </SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{body}</div>
          <div className="border-t border-border/70 px-4 pt-3">
            <div className="flex gap-3">
              <Button variant="outline" className="min-h-11 flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button className="min-h-11 flex-1" onClick={onSave}>
                {editing ? 'Save' : 'Add time'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit schedule time' : 'Add worship schedule time'}
          </DialogTitle>
        </DialogHeader>
        {body}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave}>{editing ? 'Save' : 'Add time'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}