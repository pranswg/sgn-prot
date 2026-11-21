import { useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  CopyPlus,
  FileDown,
  FileSpreadsheet,
  FileText,
  Info,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { useSuguanStore } from '@/store/suguanStore'
import { useNavStore } from '@/store/navStore'
import { useMemberStore } from '@/store/memberStore'
import { useSettingsStore } from '@/store/settingsStore'
import { formatAddedDate, formatDateLong, formatTime } from '@/lib/format'
import {
  coverageLabel,
  groupLabel,
  normalizeDocFormat,
  PAPER_SIZE_LABELS,
  serviceTypeLabel,
} from '@/lib/suguanUtils'
import { exportSuguanExcel } from '@/lib/suguanExport'
import { suguanFileName } from '@/lib/suguanUtils'
import { exportSuguanPdf } from '@/features/suguan-builder/suguanPdfExport'
import { SuguanSheetPreview } from '@/features/suguan-builder/SuguanSheetPreview'
import { ExtraOccasionPreview } from '@/features/extra-occasion-suguan/ExtraOccasionPreview'
import {
  exportExtraOccasionDocx,
  exportExtraOccasionExcel,
  exportExtraOccasionPdf,
} from '@/features/extra-occasion-suguan/extraOccasionSharedExport'
import {
  extraOccasionExportOptionsForRecord,
} from '@/features/extra-occasion-suguan/extraOccasionExport'
import { extraOccasionRecordLabel } from '@/features/extra-occasion-suguan/extraOccasionData'
import { useExportPreview } from '@/hooks/useExportPreview'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import { MobileSuguanDetailHeader } from './MobileSuguanDetailHeader'

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center rounded-full border border-border/70 bg-muted/50 px-2.5 text-[0.6875rem] font-medium text-muted-foreground">
      {children}
    </span>
  )
}

function SavedBadge() {
  return (
    <span className="inline-flex h-5 items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 text-[0.625rem] font-semibold text-emerald-700 dark:text-emerald-400">
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      Saved
    </span>
  )
}

function RailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-sm">
      <h2 className="mb-2 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </div>
  )
}

function RailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-border/60 py-1.5 text-xs last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

/**
 * One Export control: the body runs the default PDF download, the caret opens
 * the format menu. Both halves disable together while anything is exporting, so
 * a second click cannot queue a duplicate download.
 */
function ExportSplit({
  onExportPdf,
  onExportExcel,
  onExportDocx,
  busy,
  className,
}: {
  onExportPdf: () => void
  onExportExcel: () => void
  onExportDocx?: () => void
  busy: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex h-8 items-stretch overflow-hidden rounded-lg border border-border bg-background',
        busy && 'opacity-60',
        className,
      )}
    >
      <Button
        variant="ghost"
        className="h-full flex-1 justify-center rounded-none px-3"
        loading={busy}
        disabled={busy}
        onClick={onExportPdf}
      >
        <FileDown className="size-4" />
        Export
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Choose export format"
            className="h-full rounded-none border-l border-border text-muted-foreground"
            disabled={busy}
          >
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={onExportPdf}>
            <FileDown className="size-4" />
            Export PDF (.pdf)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onExportExcel}>
            <FileSpreadsheet className="size-4" />
            Export Excel (.xlsx)
          </DropdownMenuItem>
          {onExportDocx && (
            <DropdownMenuItem onSelect={onExportDocx}>
              <FileText className="size-4" />
              Export Word (.docx)
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function SuguanDetailPage() {
  const selectedSuguanId = useNavStore((s) => s.selectedSuguanId)
  const suguan = useSuguanStore((s) => s.suguan)
  const deleteSuguan = useSuguanStore((s) => s.deleteSuguan)
  const navigate = useNavStore((s) => s.navigate)
  const editSuguanInBuilder = useNavStore((s) => s.editSuguanInBuilder)
  const editExtraOccasionSuguan = useNavStore((s) => s.editExtraOccasionSuguan)
  const copySuguanAsNew = useNavStore((s) => s.copySuguanAsNew)
  const copyExtraOccasionSuguanAsNew = useNavStore(
    (s) => s.copyExtraOccasionSuguanAsNew,
  )
  const members = useMemberStore((s) => s.members)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const { can } = usePermissions()
  const canCreateSuguan = can('create-suguan')

  const s = suguan.find((su) => su.id === selectedSuguanId) ?? null

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | 'docx' | null>(null)
  const { exportPreview, requestExport } = useExportPreview()

  if (!s) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Suguan Not Found"
          actions={
            <Button variant="outline" onClick={() => navigate('suguan-history')}>
              <ArrowLeft className="size-4" />
              Back to History
            </Button>
          }
        />
        <p className="text-muted-foreground">
          The Suguan record could not be loaded.
        </p>
      </div>
    )
  }

  const isExtraOccasion = Boolean(s.extraOccasion)
  const extraOccasionLabel = isExtraOccasion ? extraOccasionRecordLabel(s) : ''
  const serviceName = isExtraOccasion ? extraOccasionLabel : serviceTypeLabel(s)
  const assignedCount = isExtraOccasion
    ? s.schedules.reduce(
        (count, schedule) => count + schedule.assignments.length,
        0,
      ) +
      Object.values(s.extraOccasion?.organistaAssignments ?? {}).reduce(
        (count, assignments) => count + assignments.length,
        0,
      )
    : s.assignments.length
  const editRecord = () =>
    isExtraOccasion
      ? editExtraOccasionSuguan(s.id)
      : editSuguanInBuilder(s.id)
  // Opens the matching editor seeded with this record but detached from it, so
  // pressing Save adds a new history entry and leaves this one untouched.
  const saveAsNew = () =>
    isExtraOccasion
      ? copyExtraOccasionSuguanAsNew(s.id)
      : copySuguanAsNew(s.id)

  const events = s.events ?? []
  const docFormat = normalizeDocFormat(s.docFormat)
  const paperLabel = `${PAPER_SIZE_LABELS[docFormat.paperSize].short} · ${
    docFormat.orientation === 'landscape' ? 'Landscape' : 'Portrait'
  }`

  const recordAssignments = isExtraOccasion
    ? s.schedules.flatMap((schedule) => schedule.assignments)
    : s.assignments
  const voiceRows = allVoices()
    .map((voice) => ({
      id: voice.id,
      name: voice.name,
      count: recordAssignments.filter(
        (assignment) => assignment.voicePosition === voice.id,
      ).length,
    }))
    .filter((row) => row.count > 0)
  const maxVoiceCount = Math.max(1, ...voiceRows.map((row) => row.count))

  const otherDates: { label: string; value: string }[] = []
  if (isExtraOccasion) {
    if (s.extraOccasion?.pagsasanay.enabled && s.extraOccasion.pagsasanay.date) {
      otherDates.push({
        label: s.extraOccasion.pagsasanay.label,
        value: formatDateLong(s.extraOccasion.pagsasanay.date),
      })
    }
    if (s.extraOccasion?.pagtupad.enabled && s.extraOccasion.pagtupad.date) {
      otherDates.push({
        label: s.extraOccasion.pagtupad.label,
        value: formatDateLong(s.extraOccasion.pagtupad.date),
      })
    }
  } else {
    if (s.pagsasanayDate) {
      otherDates.push({
        label: 'Pagsasanay',
        value: formatDateLong(s.pagsasanayDate),
      })
    }
    if (s.pagtupadDate) {
      otherDates.push({
        label: 'Pagtupad',
        value: formatDateLong(s.pagtupadDate),
      })
    }
  }

  const metaChips = (
    <>
      {s.time && <MetaChip>{formatTime(s.time)}</MetaChip>}
      <MetaChip>{assignedCount} members assigned</MetaChip>
      {isExtraOccasion ? (
        <>
          {s.extraOccasion?.localeName && (
            <MetaChip>{s.extraOccasion.localeName}</MetaChip>
          )}
          <MetaChip>{s.schedules.length} schedules</MetaChip>
        </>
      ) : (
        <>
          <MetaChip>{groupLabel(s.group)}</MetaChip>
          <MetaChip>
            {s.coverage ? coverageLabel(s.coverage) : `${events.length} events`}
          </MetaChip>
        </>
      )}
      <MetaChip>{paperLabel}</MetaChip>
    </>
  )

  const runExportExcel = async (fileName: string) => {
    setExporting('excel')
    try {
      if (s.extraOccasion) {
        await exportExtraOccasionExcel({
          ...extraOccasionExportOptionsForRecord(s, members, allVoices()),
          filename: fileName,
        })
      } else {
        await exportSuguanExcel(s, members, s.docFormat, fileName)
      }
      toast.success('SUGUAN sheet exported as Excel.')
    } catch (err) {
      console.error(err)
      toast.error('Could not export Excel.')
    } finally {
      setExporting(null)
    }
  }

  const runExportPdf = async (fileName: string) => {
    setExporting('pdf')
    try {
      if (s.extraOccasion) {
        await exportExtraOccasionPdf({
          ...extraOccasionExportOptionsForRecord(s, members, allVoices()),
          filename: fileName,
        })
      } else {
        await exportSuguanPdf(s, members, s.docFormat, undefined, 'download', fileName)
      }
      toast.success('SUGUAN sheet exported as PDF.')
    } catch (err) {
      console.error(err)
      toast.error('Could not export PDF.')
    } finally {
      setExporting(null)
    }
  }

  const handleExportExcel = () => {
    const fileName = suguanFileName(s, 'xlsx')
    requestExport({ filename: fileName, onConfirm: () => void runExportExcel(fileName) })
  }

  const handleExportPdf = () => {
    const fileName = suguanFileName(s, 'pdf')
    requestExport({ filename: fileName, onConfirm: () => void runExportPdf(fileName) })
  }

  const handleExportDocx = () => {
    if (!s.extraOccasion) return
    const fileName = suguanFileName(s, 'docx')
    requestExport({
      filename: fileName,
      onConfirm: () => void runExportDocx(fileName),
    })
  }

  const runExportDocx = async (fileName: string) => {
    if (!s.extraOccasion) return
    setExporting('docx')
    try {
      await exportExtraOccasionDocx({
        ...extraOccasionExportOptionsForRecord(s, members, allVoices()),
        filename: fileName,
      })
      toast.success('Extra Occasion Suguan exported as Word.')
    } catch (error) {
      console.error(error)
      toast.error('Could not export the Extra Occasion Suguan as Word.')
    } finally {
      setExporting(null)
    }
  }

  const exportActions = {
    onExportPdf: handleExportPdf,
    onExportExcel: handleExportExcel,
    onExportDocx: s.extraOccasion ? handleExportDocx : undefined,
    busy: exporting !== null,
  }

  return (
    <div className="flex flex-col gap-4">
      {exportPreview}
      <MobileSuguanDetailHeader
        subtitle={[serviceName, s.date ? formatDateLong(s.date) : '']
          .filter(Boolean)
          .join(' · ')}
      />

      {/* Mobile: compact record card with a 2x2 action grid above the paper. */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm md:hidden">
        <div className="flex items-center gap-2 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <span className="inline-flex h-5 items-center rounded-full bg-primary/10 px-2 text-[0.625rem] text-primary">
            AWS
          </span>
          Saved record
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {serviceName}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {formatDateLong(s.date)}
            {s.time ? ` • ${formatTime(s.time)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <MetaChip>{assignedCount} members</MetaChip>
          <MetaChip>
            {isExtraOccasion ? `${s.schedules.length} schedules` : groupLabel(s.group)}
          </MetaChip>
          <MetaChip>
            {isExtraOccasion
              ? s.extraOccasion?.localeName || paperLabel
              : s.coverage
                ? coverageLabel(s.coverage)
                : `${events.length} events`}
          </MetaChip>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-3">
          <Button className="h-9" onClick={editRecord}>
            <Pencil className="size-4" />
            Edit Suguan
          </Button>
          <ExportSplit {...exportActions} className="h-9 w-full" />
          {canCreateSuguan && (
            <Button
              variant="outline"
              className="h-9 border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
              onClick={saveAsNew}
            >
              <CopyPlus className="size-4" />
              Save as new
            </Button>
          )}
          <Button
            variant="outline"
            className="h-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="hidden flex-wrap items-center gap-2.5 md:flex">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
          onClick={() => navigate('suguan-history')}
        >
          <ArrowLeft className="size-4" />
          Back to history
        </Button>
        <span aria-hidden className="size-1 rounded-full bg-border" />
        <span className="text-[0.6875rem] text-muted-foreground">
          Saved record · read-only
        </span>
        <SavedBadge />
      </div>

      <div className="hidden flex-col gap-4 md:flex xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <span className="inline-flex h-5 items-center rounded-full bg-primary/10 px-2 text-[0.625rem] text-primary">
              AWS
            </span>
            {isExtraOccasion ? 'Extra Occasion Suguan' : 'Choir Suguan'}
          </div>
          <h1 className="mt-1.5 text-[1.375rem] font-semibold leading-tight tracking-tight text-foreground">
            {serviceName}
            {s.date && (
              <span className="font-normal text-muted-foreground">
                {' — '}
                {formatDateLong(s.date)}
              </span>
            )}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {metaChips}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ExportSplit {...exportActions} />

          <Button onClick={editRecord}>
            <Pencil className="size-4" />
            Edit Suguan
          </Button>

          <div className="hidden items-center gap-2 xl:flex">
            {canCreateSuguan && (
              <Button
                variant="outline"
                className="border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                onClick={saveAsNew}
              >
                <CopyPlus className="size-4" />
                Save as new
              </Button>
            )}
            <span aria-hidden className="h-6 w-px bg-border" />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete Suguan"
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="More Suguan actions"
                className="xl:hidden"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {canCreateSuguan && (
                <DropdownMenuItem onSelect={saveAsNew}>
                  <CopyPlus className="size-4" />
                  Save as new
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
                Delete Suguan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="mx-auto w-full max-w-6xl rounded-xl border border-border/70 bg-card p-3 shadow-sm sm:p-6">
          {/* Mobile preview heading: the paper below is the printed document. */}
          <div className="mb-3 md:hidden">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              Document Preview
            </p>
            <p className="text-[0.6875rem] text-muted-foreground">
              Preview of the saved Suguan sheet.
            </p>
          </div>
          {s.extraOccasion ? (
            <ExtraOccasionPreview
              suguan={s}
              config={s.extraOccasion}
              members={members}
              voices={allVoices()}
            />
          ) : (
            <SuguanSheetPreview
              suguan={s}
              members={members}
              docFormat={s.docFormat}
            />
          )}
        </div>

        <aside className="flex flex-col gap-3">
          <RailCard title="Record">
            <RailRow label="Service" value={serviceName} />
            <RailRow label="Date" value={formatDateLong(s.date)} />
            <RailRow label="Time" value={s.time ? formatTime(s.time) : '—'} />
            <RailRow
              label="Group"
              value={isExtraOccasion ? 'Extra Occasion' : groupLabel(s.group)}
            />
            {isExtraOccasion ? (
              <RailRow
                label="Locale"
                value={s.extraOccasion?.localeName || '—'}
              />
            ) : (
              <RailRow
                label="Coverage"
                value={
                  s.coverage ? coverageLabel(s.coverage) : `${events.length} events`
                }
              />
            )}
            <RailRow label="Assigned" value={`${assignedCount} members`} />
          </RailCard>

          {voiceRows.length > 0 && (
            <RailCard title="Assignments by voice">
              <div className="flex flex-col gap-2">
                {voiceRows.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center gap-2 text-[0.6875rem]"
                  >
                    <span className="w-16 shrink-0 truncate font-medium text-foreground">
                      {row.name}
                    </span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.round((row.count / maxVoiceCount) * 100)}%`,
                        }}
                      />
                    </span>
                    <span className="w-5 text-right tabular-nums text-muted-foreground">
                      {row.count}
                    </span>
                  </div>
                ))}
              </div>
            </RailCard>
          )}

          <RailCard title="Other dates">
            {otherDates.map((row) => (
              <RailRow key={row.label} label={row.label} value={row.value} />
            ))}
            <RailRow label="Recorded" value={formatAddedDate(s.createdAt)} />
          </RailCard>

          <div className="flex gap-2.5 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 text-[0.6875rem] leading-relaxed text-muted-foreground">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              <b className="font-semibold text-foreground">Read-only record.</b>{' '}
              “Edit Suguan” reopens this sheet in the builder and overwrites it.
              “Save as new” opens a detached copy, so the next Save adds a new
              history entry.
            </span>
          </div>
        </aside>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Suguan?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The Suguan record will be permanently
              removed from history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white"
              onClick={() => {
                deleteSuguan(s.id)
                toast.success('Suguan deleted.')
                navigate('suguan-history')
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
