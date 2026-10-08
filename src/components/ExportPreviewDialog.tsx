import { FileDown } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ExportPreviewDialogProps {
  /** The exact filename the download will use. */
  filename: string
  /** Label for the confirm button, e.g. `Export` or `Download Backup`. */
  confirmLabel?: string
  /** Fired only when the user confirms; performs the real export. */
  onConfirm: () => void
  /** Fired on Cancel, Escape, or backdrop click. */
  onCancel: () => void
}

/**
 * The verify-before-download gate every export feature runs through. Shows the
 * generated filename (the exact string the browser will save) and asks the
 * user to confirm, so no export file is ever created with a surprise name.
 */
export function ExportPreviewDialog({
  filename,
  confirmLabel = 'Export',
  onConfirm,
  onCancel,
}: ExportPreviewDialogProps) {
  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <FileDown className="size-6" />
          </AlertDialogMedia>
          <AlertDialogTitle>Export Preview</AlertDialogTitle>
          <AlertDialogDescription>
            Confirm the generated filename before the file is downloaded.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p
          aria-label="Generated filename"
          className="break-all rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5 font-mono text-[0.8125rem] leading-relaxed text-foreground"
        >
          {filename}
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}