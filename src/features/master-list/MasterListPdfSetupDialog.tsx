import { useState } from 'react'
import { FileDown, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MASTER_LIST_PAPER_SIZES,
  isMasterListPaperSize,
  type MasterListPaperSize,
} from './masterListPaperSizes'

interface MasterListPdfSetupDialogProps {
  onOpenChange: (open: boolean) => void
  savedLocaleName: string
  onExport: (localeName: string, paperSize: MasterListPaperSize) => Promise<void>
  documentType?: 'PDF' | 'Word'
}

export function MasterListPdfSetupDialog({
  onOpenChange,
  savedLocaleName,
  onExport,
  documentType = 'PDF',
}: MasterListPdfSetupDialogProps) {
  const [localeName, setLocaleName] = useState(savedLocaleName)
  const [paperSize, setPaperSize] = useState<MasterListPaperSize>('legal')
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState('')
  const selectedPaper = MASTER_LIST_PAPER_SIZES.find(
    (paper) => paper.id === paperSize,
  )!

  const handleExport = async () => {
    const name = localeName.trim()
    if (!name) {
      setError('Enter the locale congregation name to continue.')
      return
    }
    setIsExporting(true)
    setError('')
    try {
      await onExport(name, paperSize)
      onOpenChange(false)
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : `${documentType} export failed. Please try again.`,
      )
    } finally {
      setIsExporting(false)
    }
  }

  const paperWidth = 116 * (selectedPaper.width / selectedPaper.height)

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="fixed inset-x-0 bottom-0 top-auto left-0 flex max-h-[90dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-2xl p-0 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(90dvh,720px)] sm:w-[min(92vw,620px)] sm:max-w-[620px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-6 sm:px-7 sm:pt-7">
          <DialogHeader className="mb-6">
            <div className="mb-1 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="size-5" />
            </div>
            <DialogTitle className="text-xl font-semibold">
              Set up Master List {documentType}
            </DialogTitle>
            <DialogDescription>
              Choose the congregation name and paper size for your document.
            </DialogDescription>
          </DialogHeader>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Document Information</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                This name is saved for future Master List exports.
              </p>
            </div>
            <label className="block space-y-2 text-sm font-medium" htmlFor="master-list-locale">
              Locale congregation name
              <Input
                id="master-list-locale"
                autoComplete="organization"
                className="h-11 text-base"
                value={localeName}
                onChange={(event) => {
                  setLocaleName(event.target.value)
                  if (error) setError('')
                }}
                placeholder="Sta. Monica"
                aria-invalid={Boolean(error)}
              />
            </label>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </section>

          <section className="mt-7 space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Paper Size</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Select the page dimensions for the exported document.
              </p>
            </div>
            <Select
              value={paperSize}
              onValueChange={(value) => {
                if (isMasterListPaperSize(value)) setPaperSize(value)
              }}
            >
              <SelectTrigger className="h-11 w-full text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MASTER_LIST_PAPER_SIZES.map((paper) => (
                  <SelectItem key={paper.id} value={paper.id} className="py-2.5">
                    {paper.label} · {paper.width} × {paper.height} mm
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex min-h-36 items-center justify-center rounded-xl border border-dashed bg-muted/30 p-4">
              <div
                className="flex flex-col items-center justify-center border border-slate-300 bg-white px-3 py-2 text-center shadow-sm"
                style={{
                  width: `${paperWidth}px`,
                  height: '116px',
                }}
                aria-label={`${selectedPaper.label} paper preview`}
              >
                <span className="text-[7px] font-semibold tracking-wide text-slate-700">
                  MASTER LIST
                </span>
                <span className="mt-2 h-px w-4/5 bg-slate-300" />
                <span className="mt-2 h-px w-4/5 bg-slate-200" />
                <span className="mt-1 h-px w-4/5 bg-slate-200" />
                <span className="mt-1 h-px w-4/5 bg-slate-200" />
                <span className="mt-2 text-[7px] text-slate-500">
                  {selectedPaper.label} · {selectedPaper.width} × {selectedPaper.height} mm
                </span>
              </div>
            </div>
          </section>
        </div>

        <DialogFooter className="sticky bottom-0 flex-col-reverse gap-2 border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:px-7 sm:py-5">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-11 w-full sm:w-auto"
            onClick={() => void handleExport()}
            disabled={isExporting}
          >
            <FileDown className="size-4" />
            {isExporting ? `Preparing ${documentType}…` : `Export ${documentType}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
