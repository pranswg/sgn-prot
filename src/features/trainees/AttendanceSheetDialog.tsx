import { useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, FileDown } from 'lucide-react'
import { toast } from 'sonner'
import type { Member, Trainee } from '@/core/types/member'
import type { DutyRole } from '@/core/types/suguan'
import { WEEKDAY_OPTIONS } from '@/core/constants/worshipSchedules'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  addDays,
  formatDateKeyLongDate,
  isDateKey,
  todayPHT,
  type DateKey,
} from '@/lib/phDate'
import { generatePracticeDates } from './attendanceSheetDates'
import {
  exportTraineeAttendancePdf,
  type AttendanceOrientation,
  type AttendancePaperSize,
} from './traineeAttendancePdf'

const PAPER_OPTIONS: { id: AttendancePaperSize; label: string }[] = [
  { id: 'a4', label: 'A4' },
  { id: 'letter', label: 'Letter' },
  { id: 'legal', label: 'Legal' },
]

const PAPER_DIMENSIONS: Record<AttendancePaperSize, [number, number]> = {
  a4: [210, 297],
  letter: [215.9, 279.4],
  legal: [215.9, 355.6],
}

function isAttendancePaperSize(value: string): value is AttendancePaperSize {
  return PAPER_OPTIONS.some((option) => option.id === value)
}

interface AttendanceSheetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trainees: Trainee[]
  members: Member[]
  dutyRoles: DutyRole[]
  localeName: string
}

function normalizeRoleName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function AttendanceSheetDialog({
  open,
  onOpenChange,
  trainees,
  members,
  dutyRoles,
  localeName,
}: AttendanceSheetDialogProps) {
  const isMobile = useIsMobile()
  const initialStart = todayPHT()
  const [startDate, setStartDate] = useState<DateKey>(initialStart)
  const [endDate, setEndDate] = useState<DateKey>(() => addDays(initialStart, 35))
  const [weekdays, setWeekdays] = useState<number[]>([6])
  const [paperSize, setPaperSize] = useState<AttendancePaperSize>('legal')
  const [orientation, setOrientation] =
    useState<AttendanceOrientation>('landscape')
  const [pangulongMemberId, setPangulongMemberId] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const practiceDates = useMemo(
    () => generatePracticeDates(startDate, endDate, weekdays),
    [startDate, endDate, weekdays],
  )
  const pangulongRoleIds = new Set(
    dutyRoles
      .filter((role) => normalizeRoleName(role.name) === 'pangulongmangaawit')
      .map((role) => role.id),
  )
  const pangulongMembers = members
    .filter(
      (member) =>
        member.isActive &&
        (member.positions.includes('pangulong-mang-aawit') ||
          member.assignedDutyRoleIds?.includes('pangulong-mang-aawit') ===
            true ||
          member.assignedDutyRoleIds?.some((id) => pangulongRoleIds.has(id)) ===
            true),
    )
    .sort((left, right) =>
      `${left.lastName} ${left.firstName}`.localeCompare(
        `${right.lastName} ${right.firstName}`,
      ),
    )
  const selectedPangulong =
    pangulongMembers.find((member) => member.id === pangulongMemberId) ??
    (pangulongMembers.length === 1 ? pangulongMembers[0] : undefined)
  const selectedDayLabel =
    weekdays.length === 0
      ? 'Select practice days'
      : weekdays.length === 1
        ? (WEEKDAY_OPTIONS.find((option) => option.weekday === weekdays[0])
            ?.english ?? '1 day selected')
        : `${weekdays.length} days selected`
  const [paperWidth, paperHeight] = PAPER_DIMENSIONS[paperSize]
  const landscape = orientation === 'landscape'
  const previewAspectRatio = landscape
    ? `${paperHeight} / ${paperWidth}`
    : `${paperWidth} / ${paperHeight}`

  const toggleWeekday = (weekday: number, checked: boolean) => {
    setWeekdays((current) =>
      checked
        ? [...current, weekday].sort((a, b) => a - b)
        : current.filter((day) => day !== weekday),
    )
  }

  const handleExport = async () => {
    if (!isDateKey(startDate) || !isDateKey(endDate)) {
      toast.error('Enter a valid start date and end date.')
      return
    }
    if (startDate > endDate) {
      toast.error('The end date must be on or after the start date.')
      return
    }
    if (weekdays.length === 0) {
      toast.error('Select at least one practice day.')
      return
    }
    if (practiceDates.length === 0) {
      toast.error('No selected practice days fall within this date range.')
      return
    }
    if (!selectedPangulong) {
      toast.error(
        pangulongMembers.length === 0
          ? 'No active Pangulong Mang-aawit is listed in the Master List.'
          : 'Select the Pangulong Mang-aawit for the signature section.',
      )
      return
    }

    setIsExporting(true)
    try {
      await exportTraineeAttendancePdf({
        trainees,
        practiceDates,
        startDate,
        endDate,
        localeName,
        pangulongName: [
          selectedPangulong.firstName,
          selectedPangulong.middleName,
          selectedPangulong.lastName,
          selectedPangulong.suffix,
        ]
          .filter(Boolean)
          .join(' '),
        paperSize,
        orientation,
      })
      onOpenChange(false)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'The attendance sheet could not be generated.'
      toast.error(message)
    } finally {
      setIsExporting(false)
    }
  }

  const paperPreview = (
    <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/30 p-3">
      <div
        aria-hidden="true"
        className="flex h-14 shrink-0 items-center justify-center rounded-sm border border-border bg-white shadow-sm"
        style={{ aspectRatio: previewAspectRatio }}
      >
        <div
          className="h-3/4 w-3/4 border border-dashed border-slate-300"
        />
      </div>
      <div>
        <p className="text-sm font-medium">{PAPER_OPTIONS.find((item) => item.id === paperSize)?.label} paper</p>
        <p className="text-xs text-muted-foreground">
          {landscape ? 'Landscape' : 'Portrait'} layout · {practiceDates.length} practice date
          {practiceDates.length === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  )

  const configuration = (
    <>
      <div className="space-y-5 px-4 py-4 md:px-6">
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Attendance Period</h3>
            <p className="text-xs text-muted-foreground">
              Practice dates are added automatically within this range.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="attendance-start-date">Start Date</Label>
              <Input
                id="attendance-start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="h-12 md:h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="attendance-end-date">End Date</Label>
              <Input
                id="attendance-end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="h-12 md:h-10"
              />
            </div>
          </div>
          {practiceDates.length > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" />
              {formatDateKeyLongDate(practiceDates[0])} through{' '}
              {formatDateKeyLongDate(practiceDates[practiceDates.length - 1])}
              {' · '}
              {practiceDates.length} date{practiceDates.length === 1 ? '' : 's'}
            </p>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Practice Schedule</h3>
            <p className="text-xs text-muted-foreground">
              Select every day when choir practice is held.
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full justify-between px-3 font-normal md:h-10"
                aria-label="Select practice days"
              >
                <span className="truncate">{selectedDayLabel}</span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Practice Days
              </DropdownMenuLabel>
              {WEEKDAY_OPTIONS.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.weekday}
                  checked={weekdays.includes(option.weekday)}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(value) =>
                    toggleWeekday(option.weekday, value === true)
                  }
                >
                  {option.english}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Paper Size</h3>
            <p className="text-xs text-muted-foreground">
              Choose the paper used for printing the sheet.
            </p>
          </div>
          <Select
            value={paperSize}
            onValueChange={(value) => {
              if (isAttendancePaperSize(value)) setPaperSize(value)
            }}
          >
            <SelectTrigger className="h-12 md:h-10" aria-label="Select paper size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAPER_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {paperPreview}
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Orientation</h3>
            <p className="text-xs text-muted-foreground">
              Choose portrait or landscape page layout.
            </p>
          </div>
          <Select
            value={orientation}
            onValueChange={(value) => {
              if (value === 'portrait' || value === 'landscape') {
                setOrientation(value)
              }
            }}
          >
            <SelectTrigger className="h-12 md:h-10" aria-label="Select orientation">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait">Portrait</SelectItem>
              <SelectItem value="landscape">Landscape</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Pangulong Mang-aawit</h3>
            <p className="text-xs text-muted-foreground">
              The signatory is selected from active members listed with this
              position in the Master List.
            </p>
          </div>
          <Select
            value={selectedPangulong?.id ?? pangulongMemberId}
            onValueChange={setPangulongMemberId}
            disabled={pangulongMembers.length === 0}
          >
            <SelectTrigger
              className="h-12 md:h-10"
              aria-label="Select Pangulong Mang-aawit signatory"
            >
              <SelectValue
                placeholder={
                  pangulongMembers.length === 0
                    ? 'No active Pangulong listed'
                    : 'Select a Pangulong Mang-aawit'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {pangulongMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {[
                    member.firstName,
                    member.middleName,
                    member.lastName,
                    member.suffix,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>
      </div>
    </>
  )

  const actions = (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-11"
        onClick={() => onOpenChange(false)}
        disabled={isExporting}
      >
        Cancel
      </Button>
      <Button
        type="button"
        className="h-11"
        onClick={() => void handleExport()}
        disabled={isExporting}
      >
        <FileDown className="size-4" />
        {isExporting ? 'Generating PDF…' : 'Generate PDF'}
      </Button>
    </>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton
          className="max-h-[94dvh] gap-0 overflow-hidden rounded-t-2xl p-0"
        >
          <SheetHeader className="shrink-0 border-b border-border/70 px-5 py-4 pr-14">
            <SheetTitle>Generate Attendance Sheet</SheetTitle>
            <SheetDescription>
              Configure the attendance dates and printable page.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">{configuration}</div>
          <SheetFooter className="shrink-0 grid grid-cols-2 border-t border-border/70 bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {actions}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 px-6 py-5 pr-12">
          <DialogTitle>Generate Attendance Sheet</DialogTitle>
          <DialogDescription>
            Configure the attendance dates and printable page.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto">{configuration}</div>
        <DialogFooter className="px-6">
          {actions}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
