import { useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  FileDown,
  FileSpreadsheet,
  FileText,
  MoreHorizontal,
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
import { formatDateLong, formatTime } from '@/lib/format'
import {
  coverageLabel,
  groupLabel,
  serviceTypeLabel,
  suguanTitle,
} from '@/lib/suguanUtils'
import { exportSuguanExcel } from '@/lib/suguanExport'
import { suguanFileName } from '@/lib/suguanUtils'
import { exportSuguanPdf } from '@/features/suguan-builder/suguanPdfExport'
import { SuguanSheetPreview } from '@/features/suguan-builder/SuguanSheetPreview'
import { useExportPreview } from '@/hooks/useExportPreview'
import { MobileSuguanDetailHeader } from './MobileSuguanDetailHeader'

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-lg border border-border/70 bg-secondary px-2.5 py-1 text-[0.6875rem] font-medium text-muted-foreground">
      {children}
    </span>
  )
}

export function SuguanDetailPage() {
  const selectedSuguanId = useNavStore((s) => s.selectedSuguanId)
  const suguan = useSuguanStore((s) => s.suguan)
  const deleteSuguan = useSuguanStore((s) => s.deleteSuguan)
  const navigate = useNavStore((s) => s.navigate)
  const editSuguanInBuilder = useNavStore((s) => s.editSuguanInBuilder)
  const members = useMemberStore((s) => s.members)

  const s = suguan.find((su) => su.id === selectedSuguanId) ?? null

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)
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

  const serviceName = serviceTypeLabel(s)

  const events = s.events ?? []

  const runExportExcel = async (fileName: string) => {
    setExporting('excel')
    try {
      await exportSuguanExcel(s, members, s.docFormat, fileName)
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
      await exportSuguanPdf(s, members, s.docFormat, undefined, 'download', fileName)
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

  return (
    <div className="flex flex-col gap-4 pb-10 md:pb-0">
      {exportPreview}
      <MobileSuguanDetailHeader />

      {/* Mobile: top information card with compact, wrap-friendly actions. */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm md:hidden">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {suguanTitle(s)}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {formatDateLong(s.date)}
            {s.time ? ` • ${formatTime(s.time)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <MetaChip>{s.assignments.length} members</MetaChip>
          <MetaChip>{groupLabel(s.group)}</MetaChip>
          <MetaChip>
            {s.coverage
              ? coverageLabel(s.coverage)
              : `${events.length} events`}
          </MetaChip>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('suguan-history')}
          >
            <ArrowLeft className="size-3.5" />
            Back to History
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            loading={exporting === 'pdf'}
            disabled={exporting !== null}
          >
            <FileDown className="size-3.5" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            loading={exporting === 'excel'}
            disabled={exporting !== null}
          >
            <FileSpreadsheet className="size-3.5" />
            Export Excel
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="More actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => editSuguanInBuilder(s.id)}>
                <FileText className="size-4" />
                Edit Suguan
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onSelect={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <PageHeader
        className="hidden md:flex"
        title={`${serviceName} — ${formatDateLong(s.date)}`}
        description={`${s.assignments.length} members • ${groupLabel(s.group)}${
          s.coverage
            ? ` • ${coverageLabel(s.coverage)}`
            : ` • ${events.length} events`
        }`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('suguan-history')}>
              <ArrowLeft className="size-4" />
              History
            </Button>
            <Button
              variant="outline"
              onClick={handleExportExcel}
              loading={exporting === 'excel'}
              disabled={exporting !== null}
            >
              <FileSpreadsheet className="size-4" />
              Export Excel (.xlsx)
            </Button>
            <Button
              variant="outline"
              onClick={handleExportPdf}
              loading={exporting === 'pdf'}
              disabled={exporting !== null}
            >
              <FileDown className="size-4" />
              Export PDF (.pdf)
            </Button>
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

      <div className="mx-auto w-full max-w-6xl rounded-xl border border-border/70 bg-card p-3 shadow-sm sm:p-6">
        {/* Mobile preview heading: the paper below is the printed document. */}
        <div className="mb-3 md:hidden">
          <p className="text-sm font-semibold tracking-tight text-foreground">
            Document Preview
          </p>
          <p className="text-[0.6875rem] text-muted-foreground">
            The printed Suguan — identical to the PDF export.
          </p>
        </div>
        <SuguanSheetPreview
          suguan={s}
          members={members}
          docFormat={s.docFormat}
          previewWidth={900}
        />

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

      {/* Mobile: fixed export bar, parked above the bottom tab bar
          (63px + safe-area = its height). */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)_+_63px)] z-30 flex items-center gap-2 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        <Button
          className="flex-1"
          onClick={handleExportPdf}
          loading={exporting === 'pdf'}
          disabled={exporting !== null}
        >
          <FileDown className="size-4" />
          Export PDF
        </Button>
        <Button
          variant="outline"
          onClick={handleExportExcel}
          loading={exporting === 'excel'}
          disabled={exporting !== null}
        >
          <FileSpreadsheet className="size-4" />
          Export Excel
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Edit Suguan"
          onClick={() => editSuguanInBuilder(s.id)}
        >
          <FileText className="size-4" />
        </Button>
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