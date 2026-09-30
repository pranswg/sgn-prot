import { useState } from 'react'
import { ArrowLeft, FileDown, FileImage, FileSpreadsheet, FileText, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
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
import { useSettingsStore } from '@/store/settingsStore'
import { useMemberStore } from '@/store/memberStore'
import { formatDateLong, formatTime } from '@/lib/format'
import {
  coverageLabel,
  groupLabel,
  serviceTypeLabel,
  suguanTitle,
} from '@/lib/suguanUtils'
import { exportSuguanExcel } from '@/lib/suguanExport'
import { exportSuguanPdf } from '@/features/suguan-builder/suguanPdfExport'
import { exportKoroPng, exportKoroPdf, koroVoiceColor } from '@/lib/koro'
import { SuguanSheetPreview } from '@/features/suguan-builder/SuguanSheetPreview'

export function SuguanDetailPage() {
  const selectedSuguanId = useNavStore((s) => s.selectedSuguanId)
  const suguan = useSuguanStore((s) => s.suguan)
  const deleteSuguan = useSuguanStore((s) => s.deleteSuguan)
  const navigate = useNavStore((s) => s.navigate)
  const editSuguanInBuilder = useNavStore((s) => s.editSuguanInBuilder)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const voices = allVoices()
  const members = useMemberStore((s) => s.members)

  const s = suguan.find((su) => su.id === selectedSuguanId) ?? null

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [exporting, setExporting] = useState<
    'excel' | 'pdf' | 'koro-png' | 'koro-pdf' | null
  >(null)

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

  const serviceName = serviceTypeLabel(s)

  const events = s.events ?? []
  const isSpecial = s.type === 'special'
  const formation = s.formation ?? null

  const voiceLabels: Record<string, string> = {}
  for (const v of voices) voiceLabels[v.id] = v.shortName

  const handleExportKoroPng = async () => {
    if (!formation || !formation.cells.some(Boolean)) {
      toast.error('The Koro formation is empty.')
      return
    }
    setExporting('koro-png')
    try {
      await exportKoroPng({
        formation,
        title: suguanTitle(s),
        subtitle: `${formatDateLong(s.date)} • ${formation.rows}×${formation.cols} grid`,
        fileName: `Koro_${s.eventTitle || s.date}`,
        voiceLabels,
        docFormat: s.docFormat,
      })
      toast.success('Koro formation exported as image (.png).')
    } catch (err) {
      console.error(err)
      toast.error('Could not export the Koro image.')
    } finally {
      setExporting(null)
    }
  }

  const handleExportKoroPdf = async () => {
    if (!formation || !formation.cells.some(Boolean)) {
      toast.error('The Koro formation is empty.')
      return
    }
    setExporting('koro-pdf')
    try {
      await exportKoroPdf({
        formation,
        title: suguanTitle(s),
        subtitle: `${formatDateLong(s.date)} • ${formation.rows}×${formation.cols} grid`,
        fileName: `Koro_${s.eventTitle || s.date}`,
        voiceLabels,
        docFormat: s.docFormat,
      })
      toast.success('Koro formation exported as PDF.')
    } catch (err) {
      console.error(err)
      toast.error('Could not export the Koro PDF.')
    } finally {
      setExporting(null)
    }
  }

  const handleExportExcel = async () => {
    setExporting('excel')
    try {
      await exportSuguanExcel(s, members, s.docFormat)
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
      await exportSuguanPdf(s, members, s.docFormat)
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
      <PageHeader
        title={`${serviceName} — ${formatDateLong(s.date)}`}
        description={`${s.assignments.length} members • ${groupLabel(s.group)}${
        isSpecial
          ? formation && formation.cells.some(Boolean)
            ? ` • ${formation.rows}×${formation.cols} formation`
            : ''
          : s.coverage
            ? ` • ${coverageLabel(s.coverage)}`
            : ` • ${events.length} events`
      }`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('suguan-history')}>
              <ArrowLeft className="size-4" />
              History
            </Button>
            {isSpecial ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleExportExcel}
                  disabled={exporting !== null}
                >
                  <FileSpreadsheet className="size-4" />
                  Export Sheet (.xlsx)
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportPdf}
                  disabled={exporting !== null}
                >
                  <FileDown className="size-4" />
                  Export Sheet (.pdf)
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportKoroPng}
                  disabled={exporting !== null}
                >
                  <FileImage className="size-4" />
                  Export Koro PNG
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportKoroPdf}
                  disabled={exporting !== null}
                >
                  <FileDown className="size-4" />
                  Export Koro PDF
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleExportExcel} disabled={exporting !== null}>
                  <FileSpreadsheet className="size-4" />
                  Export Excel (.xlsx)
                </Button>
                <Button variant="outline" onClick={handleExportPdf} disabled={exporting !== null}>
                  <FileDown className="size-4" />
                  Export PDF (.pdf)
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => editSuguanInBuilder(s.id)}>
              <FileText className="size-4" />
              Edit
            </Button>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-6xl overflow-x-auto rounded-md border bg-card p-4 shadow-sm sm:p-6">
        {isSpecial ? (
          <div className="space-y-4">
            <div className="mb-6 text-center">
              <h2 className="text-base font-bold uppercase leading-snug tracking-wide sm:text-lg">
                {suguanTitle(s)}
              </h2>
              <p className="mt-1 text-sm font-semibold">{groupLabel(s.group)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDateLong(s.date)}
                {s.time ? ` • ${formatTime(s.time)}` : ''}
              </p>
            </div>
            {formation && formation.cells.some(Boolean) ? (
              <div className="space-y-4">
                <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Koro Formation — {formation.rows} rows × {formation.cols} columns
                </p>
                <div
                  className="mx-auto grid max-w-3xl gap-1.5"
                  style={{
                    gridTemplateColumns: `repeat(${formation.cols}, minmax(0, 1fr))`,
                  }}
                >
                  {formation.cells.map((cell, i) => (
                    <div
                      key={i}
                      className="flex min-h-10 items-center justify-center rounded-lg border-2 px-1 py-2 text-center text-xs font-semibold"
                      style={
                        cell
                          ? { borderColor: koroVoiceColor(cell.voicePosition) }
                          : { borderColor: 'rgba(100,116,139,0.25)' }
                      }
                    >
                      {cell ? cell.memberName : ''}
                    </div>
                  ))}
                </div>
                {s.assignments.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No members are assigned to this Suguan yet.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No Koro formation has been arranged for this event. Open the
                  Koro Maker from the Suguan Builder to plan the layout.
                </p>
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {s.assignments.length === 0
                    ? 'No members are assigned to this event yet.'
                    : `${s.assignments.length} members assigned.`}
                </p>
              </div>
            )}

            <div className="pt-4">
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                SUGUAN Sheet Preview
              </p>
              <SuguanSheetPreview
                suguan={s}
                members={members}
                docFormat={s.docFormat}
                previewWidth={900}
              />
            </div>
          </div>
        ) : (
          <SuguanSheetPreview
            suguan={s}
            members={members}
            docFormat={s.docFormat}
            previewWidth={900}
          />
        )}

        {s.pagsasanayDate && (
          <p className="mt-4 text-xs text-muted-foreground">
            Petsa ng Pagsasanay: {s.pagsasanayDate}
          </p>
        )}
        {s.pagtupadDate && (
          <p className="mt-4 text-xs text-muted-foreground">
            Petsa ng Pagtupad: {s.pagtupadDate}
          </p>
        )}
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