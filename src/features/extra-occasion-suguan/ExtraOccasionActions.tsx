import type { ReactNode } from 'react'
import { Eye, FileDown, FileSpreadsheet, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ExtraOccasionExportKind } from './extraOccasionExportActions'

interface ExtraOccasionActionsProps {
  canExport: boolean
  exporting: ExtraOccasionExportKind | 'preview' | null
  onPreview: () => void
  onExport: (kind: ExtraOccasionExportKind, label: string) => void
  children?: ReactNode
}

const EXPORT_OPTIONS = [
  { kind: 'pdf', label: 'PDF', icon: FileDown },
  { kind: 'xlsx', label: 'Excel', icon: FileSpreadsheet },
  { kind: 'docx', label: 'Word', icon: FileText },
] as const

/**
 * The Extra Occasion action bar. On a phone the four export actions sit above a
 * sticky footer that carries the save action; from lg up every action shares
 * one bottom bar, exports on the left and save on the right.
 */
export function ExtraOccasionActions({
  canExport,
  exporting,
  onPreview,
  onExport,
  children,
}: ExtraOccasionActionsProps) {
  const exports = (
    <div className="occasion-export-buttons">
      <Button
        variant="outline"
        onClick={onPreview}
        loading={exporting === 'preview'}
        disabled={exporting !== null}
      >
        <Eye className="size-4" />
        Preview PDF
      </Button>
      {EXPORT_OPTIONS.map(({ kind, label, icon: Icon }) => (
        <Button
          key={kind}
          variant="outline"
          onClick={() => onExport(kind, label)}
          loading={exporting === kind}
          disabled={exporting !== null}
        >
          <Icon className="size-4" />
          <span>
            <span className="hidden lg:inline">Export </span>
            {label}
          </span>
        </Button>
      ))}
    </div>
  )

  return (
    <>
      {canExport && <div className="lg:hidden">{exports}</div>}
      {(canExport || children) && (
        <footer className="occasion-actions">
          {canExport && <div className="hidden lg:block">{exports}</div>}
          {children && <div className="occasion-save-actions">{children}</div>}
        </footer>
      )}
    </>
  )
}
