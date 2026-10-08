import { useState } from 'react'
import { ExportPreviewDialog } from '@/components/ExportPreviewDialog'

export interface PendingExport {
  /** The exact filename that will be downloaded (already timestamped). */
  filename: string
  confirmLabel?: string
  /** Performs the real download; called only after the user confirms. */
  onConfirm: () => void
}

/**
 * One-file confirm gate for exports. Call `requestExport` with a filename and
 * the download action; the returned `ExportPreview` element (rendered once in
 * the calling page) shows the filename and defers the download until the user
 * says Export. Keeps every export flow identical: build the name first, then
 * hand it to this hook.
 */
export function useExportPreview() {
  const [pending, setPending] = useState<PendingExport | null>(null)

  const requestExport = (next: PendingExport) => setPending(next)

  const exportPreview = pending ? (
    <ExportPreviewDialog
      filename={pending.filename}
      confirmLabel={pending.confirmLabel}
      onCancel={() => setPending(null)}
      onConfirm={() => {
        const run = pending.onConfirm
        setPending(null)
        run()
      }}
    />
  ) : null

  return { exportPreview, requestExport }
}