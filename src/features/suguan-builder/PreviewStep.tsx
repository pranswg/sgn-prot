import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  FileDown,
  FileSpreadsheet,
  Info,
  Save,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { detectConflicts, type Conflict } from '@/lib/conflicts'
import { formatDateLong, formatTime } from '@/lib/format'
import { coverageLabel, groupLabel } from '@/lib/suguanUtils'
import { exportSuguanExcel } from '@/lib/suguanExport'
import { cn } from '@/lib/utils'
import { useMemberStore } from '@/store/memberStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useSuguanStore } from '@/store/suguanStore'
import { exportSuguanPdf } from './suguanPdfExport'
import { buildPreviewSuguan, saveBlockers, totalAssigned, type SuguanDraft } from './builderState'

const MAX_VISIBLE_CONFLICTS = 5

interface PreviewStepProps {
  draft: SuguanDraft
  onSave: () => void
  isExisting: boolean
  /** Id of the Suguan being edited, excluded from conflict detection. */
  editingId?: string | null
}

export function PreviewStep({
  draft,
  onSave,
  isExisting,
  editingId,
}: PreviewStepProps) {
  const members = useMemberStore((s) => s.members)
  const suguanList = useSuguanStore((s) => s.suguan)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const allDutyRoles = useSettingsStore((s) => s.allDutyRoles)
  const allServiceTypes = useSettingsStore((s) => s.allServiceTypes)
  const voices = allVoices()

  const preview = useMemo(() => buildPreviewSuguan(draft), [draft])
  const blockers = useMemo(() => saveBlockers(draft), [draft])

  const conflicts = useMemo(() => {
    const others = editingId
      ? suguanList.filter((s) => s.id !== editingId)
      : suguanList
    return detectConflicts({ suguan: preview, members, allSuguan: others })
  }, [preview, members, suguanList, editingId])

  const errors = conflicts.filter((c) => c.severity === 'error')
  const warnings = conflicts.filter((c) => c.severity === 'warning')
  const canSave = blockers.length === 0 && errors.length === 0

  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)

  const dutyRoleName = (id: string) => {
    const match = allDutyRoles().find((r) => r.id === id)
    if (match) return match.name
    return id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ')
  }

  const assignmentCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of suguanList) {
      if (s.id === preview.id) continue
      for (const a of s.assignments) {
        counts.set(a.memberId, (counts.get(a.memberId) ?? 0) + 1)
      }
    }
    return counts
  }, [suguanList, preview.id])

  const serviceName =
    allServiceTypes().find((t) => t.id === draft.serviceTypeId)?.name ??
    draft.serviceTypeId

  const handleExportExcel = async () => {
    setExporting('excel')
    try {
      await exportSuguanExcel(preview, members, draft.docFormat)
      toast.success('SUGUAN sheet exported as Excel.')
    } catch (err) {
      console.error(err)
      toast.error('Could not export Excel.')
    } finally {
      setExporting(null)
    }
  }

  const handleExportPdf = async () => {
    setExporting('pdf')
    try {
      await exportSuguanPdf(preview, members, draft.docFormat)
      toast.success('SUGUAN sheet exported as PDF.')
    } catch (err) {
      console.error(err)
      toast.error('Could not export PDF.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onSave} disabled={!canSave}>
          <Save className="size-4" />
          {isExisting ? 'Save Changes' : 'Save Suguan'}
        </Button>
        <Button variant="outline" onClick={handleExportPdf} disabled={exporting !== null}>
          <FileDown className="size-4" />
          Export PDF
        </Button>
        <Button variant="outline" onClick={handleExportExcel} disabled={exporting !== null}>
          <FileSpreadsheet className="size-4" />
          Export Excel
        </Button>
        {blockers.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Complete the steps above to enable saving.
          </p>
        )}
      </div>

      {blockers.length > 0 && (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <ul className="flex list-disc flex-col gap-0.5 pl-4">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Date: </span>
              <span className="font-medium">{formatDateLong(draft.date)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Time: </span>
              <span className="font-medium">{formatTime(draft.time)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Service: </span>
              <span className="font-medium">{serviceName}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Choir: </span>
              <span className="font-medium">{groupLabel(draft.group)}</span>
            </p>
            {draft.coverage && (
              <p>
                <span className="text-muted-foreground">Coverage: </span>
                <span className="font-medium">{coverageLabel(draft.coverage)}</span>
              </p>
            )}
            <p className="pt-2">
              <Badge variant="outline">
                {totalAssigned(draft)} member
                {totalAssigned(draft) !== 1 ? 's' : ''} assigned
              </Badge>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Schedules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {draft.schedules.length === 0 && (
              <p className="text-muted-foreground">
                No schedules — assignments are saved as a single roster.
              </p>
            )}
            {draft.schedules.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">
                  {i + 1}. {s.scheduleLabel}
                </span>
                <Badge variant="outline" className="shrink-0 tabular-nums">
                  {s.assignments.length}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Voice Sections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {voices.map((v) => {
                const capacity = draft.voiceCapacities[v.id] ?? 0
                const count = draft.assignments.filter(
                  (a) => a.voicePosition === v.id,
                ).length
                const state = count > capacity ? 'over' : count === capacity ? 'full' : 'under'
                return (
                  <div
                    key={v.id}
                    className={cn(
                      'rounded-md border p-2 text-center',
                      state === 'full' && 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30',
                      state === 'over' && 'border-amber-400 bg-amber-50 dark:bg-amber-950/30',
                    )}
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      {v.shortName}
                    </p>
                    <p className="text-lg font-semibold tabular-nums">
                      {count}
                      <span className="text-sm font-normal text-muted-foreground">
                        /{capacity}
                      </span>
                    </p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Duty Roles & Leadership</CardTitle>
          </CardHeader>
          <CardContent>
            {draft.dutyRoles.length === 0 && !draft.destinadoName ? (
              <p className="text-sm text-muted-foreground">
                No duty roles assigned.
              </p>
            ) : (
              <div className="flex flex-col gap-1 text-sm">
                {draft.dutyRoles.map((d) => (
                  <div
                    key={d.dutyRoleId}
                    className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-1.5"
                  >
                    <span className="text-muted-foreground">
                      {dutyRoleName(d.dutyRoleId)}
                    </span>
                    <span className="truncate font-medium">{d.memberName}</span>
                  </div>
                ))}
                {draft.destinadoName && (
                  <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-1.5">
                    <span className="text-muted-foreground">Destinado</span>
                    <span className="truncate font-medium">
                      {draft.destinadoName}
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Duty Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-xs text-muted-foreground">
              Prior assignment counts from Suguan history. Members with fewer past
              duties are highlighted.
            </p>
            <div className="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto text-sm">
              {draft.assignments.map((a) => {
                const count = assignmentCounts.get(a.memberId) ?? 0
                return (
                  <div
                    key={`${a.memberId}-${a.voicePosition}`}
                    className="flex items-center justify-between gap-2 rounded px-2 py-1"
                  >
                    <span className="truncate text-muted-foreground">
                      {a.memberName}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        count < 5
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : '',
                      )}
                    >
                      {count}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className={cn(errors.length > 0 && 'border-red-400')}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Conflict Check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {errors.length === 0 && warnings.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
              No conflicts detected.
            </p>
          )}
          {errors.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-red-300/60 bg-red-50/40 dark:border-red-900/60 dark:bg-red-950/20">
              <div className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-red-800 dark:text-red-200">
                <XCircle className="size-4" />
                Errors ({errors.length})
              </div>
              <div className="space-y-2 px-3 pb-3">
                <ConflictList conflicts={errors} />
              </div>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-amber-300/60 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
                <Info className="size-4" />
                Warnings ({warnings.length})
              </div>
              <div className="space-y-2 px-3 pb-3">
                <ConflictList conflicts={warnings} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ConflictList({ conflicts }: { conflicts: Conflict[] }) {
  const hidden = conflicts.length - MAX_VISIBLE_CONFLICTS

  return (
    <>
      {conflicts.slice(0, MAX_VISIBLE_CONFLICTS).map((c, i) => (
        <ConflictRow key={`${c.type}-${i}`} conflict={c} />
      ))}
      {hidden > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between border border-dashed text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Show all {conflicts.length} items
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="max-h-72 w-[min(28rem,calc(100vw-2rem))] overflow-y-auto"
          >
            {conflicts.map((c, i) => (
              <DropdownMenuItem
                key={`${c.type}-d${i}`}
                className="items-start gap-2 whitespace-normal py-2"
              >
                <ConflictRow conflict={c} plain />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  )
}

function ConflictRow({
  conflict,
  plain,
}: {
  conflict: Conflict
  plain?: boolean
}) {
  const Icon = conflict.severity === 'error' ? XCircle : Info
  return (
    <div
      className={cn(
        'flex items-start gap-2 text-sm',
        plain
          ? 'text-foreground'
          : cn(
              'rounded-md px-3 py-2',
              conflict.severity === 'error'
                ? 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200'
                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200',
            ),
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="flex items-center gap-2 font-medium">
          {conflict.severity === 'error' ? 'Error' : 'Warning'}
          <span className="text-xs font-normal opacity-70">
            {conflict.type.replace(/-/g, ' ')}
          </span>
        </p>
        <p className="opacity-85">{conflict.message}</p>
      </div>
    </div>
  )
}
