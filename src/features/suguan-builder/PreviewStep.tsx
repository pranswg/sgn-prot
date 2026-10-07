import { useMemo, useState } from 'react'
import { FileDown, FileSpreadsheet, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatDateLong, formatTime } from '@/lib/format'
import { coverageLabel, groupLabel } from '@/lib/suguanUtils'
import { exportSuguanExcel } from '@/lib/suguanExport'
import { cn } from '@/lib/utils'
import { useMemberStore } from '@/store/memberStore'
import { useSettingsStore } from '@/store/settingsStore'
import { exportSuguanPdf } from './suguanPdfExport'
import { SuguanSheetPreview } from './SuguanSheetPreview'
import { buildPreviewSuguan, saveBlockers, totalAssigned, type SuguanDraft } from './builderState'

interface PreviewStepProps {
  draft: SuguanDraft
  onSave: () => void
  isExisting: boolean
}

export function PreviewStep({
  draft,
  onSave,
  isExisting,
}: PreviewStepProps) {
  const members = useMemberStore((s) => s.members)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const allServiceTypes = useSettingsStore((s) => s.allServiceTypes)
  const voices = allVoices()

  const preview = useMemo(() => buildPreviewSuguan(draft), [draft])
  const blockers = useMemo(() => saveBlockers(draft), [draft])

  const canSave = blockers.length === 0

  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)

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

      <section aria-labelledby="suguan-document-preview-title" className="space-y-2">
        <div>
          <h2
            id="suguan-document-preview-title"
            className="text-sm font-semibold tracking-tight"
          >
            Document Preview
          </h2>
          <p className="text-xs text-muted-foreground">
            This is the sheet layout used for the PDF export.
          </p>
        </div>
        <SuguanSheetPreview
          suguan={preview}
          members={members}
          docFormat={draft.docFormat}
          previewWidth={900}
        />
      </section>
    </div>
  )
}
