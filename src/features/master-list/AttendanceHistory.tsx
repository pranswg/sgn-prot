import { useMemo, useState } from 'react'
import { FileDown, FileText, MoreHorizontal, Trash2 } from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAttendanceStore } from '@/store/attendanceStore'
import { useSettingsStore } from '@/store/settingsStore'
import { formatDateKey, formatPHTDateTime } from '@/lib/phDate'
import type { Choir, Member, Trainee } from '@/core/types/member'
import { CHOIR_LABELS, membersOf, traineesOf } from '@/lib/choirs'
import { useExportPreview } from '@/hooks/useExportPreview'
import { exportMasterListAttendancePdf } from './masterListAttendancePdf'
import { exportMasterListAttendanceWord } from './masterListAttendanceWord'
import type { MasterListAttendanceOptions } from './masterListAttendancePdf'
import { exportFileName } from '@/lib/exportNaming'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AttendanceHistoryProps {
  choir: Choir
  members: Member[]
  trainees: Trainee[]
  canEditMembers: boolean
  onOpen: (id: string) => void
}

export function AttendanceHistory({
  choir,
  members,
  trainees,
  canEditMembers,
  onOpen,
}: AttendanceHistoryProps) {
  const sheets = useAttendanceStore((s) => s.sheets)
  const voices = useSettingsStore((s) => s.voices)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const { exportPreview, requestExport } = useExportPreview()

  const choirSheets = useMemo(
    () =>
      sheets
        .filter((sheet) => sheet.choir === choir)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [sheets, choir],
  )

  const roster = membersOf(members, choir)
  const activeTrainees = traineesOf(trainees, choir).filter(
    (trainee) => trainee.status === 'active',
  )

  const handleExportFromHistory = (
    sheet: typeof choirSheets[number],
    format: 'pdf' | 'word',
  ) => {
    const extension = format === 'pdf' ? 'pdf' : 'docx'
    const fileName = exportFileName(sheet.title, extension)
    requestExport({
      filename: fileName,
      confirmLabel: `Export ${format === 'pdf' ? 'PDF' : 'Word'}`,
      onConfirm: () => {
        void (async () => {
          try {
            const options: MasterListAttendanceOptions = {
              ...sheet,
              members: roster,
              trainees: activeTrainees,
              voices,
              selectedVoiceIds: sheet.voiceIds,
              filename: fileName,
              choir,
            }
            if (format === 'pdf') {
              await exportMasterListAttendancePdf(options)
            } else {
              await exportMasterListAttendanceWord(options)
            }
            useAttendanceStore.getState().markExported(sheet.id)
            toast.success(
              `Attendance sheet exported as ${format === 'pdf' ? 'PDF' : 'Word'}.`,
            )
          } catch (error) {
            console.error(error)
            toast.error(
              error instanceof Error
                ? `Attendance sheet ${format === 'pdf' ? 'PDF' : 'Word'} export failed: ${error.message}`
                : `Could not export the attendance sheet as ${format === 'pdf' ? 'PDF' : 'Word'}.`,
            )
          }
        })()
      },
    })
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    useAttendanceStore.getState().deleteSheet(deleteTarget)
    setDeleteTarget(null)
    toast.success('Attendance sheet deleted.')
  }

  if (choirSheets.length === 0) {
    return (
      <section className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        No attendance sheets yet.
        <p className="mt-1 text-sm">
          Create one from New Attendance Sheet.
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="card">
        <table>
          <thead>
            <tr>
              <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground border-b border-border/70">
                Title
              </th>
              <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground border-b border-border/70">
                Dates
              </th>
              <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground border-b border-border/70">
                Choir
              </th>
              <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground border-b border-border/70">
                Voices
              </th>
              <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground border-b border-border/70">
                Created
              </th>
              <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground border-b border-border/70">
                Status
              </th>
              <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground border-b border-border/70" style={{ width: 150 }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {choirSheets.map((sheet) => (
              <tr key={sheet.id}>
                <td className="p-2 align-middle whitespace-nowrap border-b border-border/70 font-medium">
                  {sheet.title}
                </td>
                <td className="p-2 align-middle whitespace-nowrap border-b border-border/70 text-muted-foreground text-sm">
                  {sheet.dates.map((date) => formatDateKey(date)).join(' · ')}
                </td>
                <td className="p-2 align-middle whitespace-nowrap border-b border-border/70">
                  {CHOIR_LABELS[sheet.choir]}
                </td>
                <td className="p-2 align-middle whitespace-nowrap border-b border-border/70 text-muted-foreground text-sm">
                  {sheet.groupByVoice
                    ? `${sheet.voiceIds.length} sections`
                    : 'All members'}
                </td>
                <td className="p-2 align-middle whitespace-nowrap border-b border-border/70 text-muted-foreground text-sm">
                  {formatPHTDateTime(new Date(sheet.createdAt), {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </td>
                <td className="p-2 align-middle whitespace-nowrap border-b border-border/70">
                  <span
                    className={cn(
                      'inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium',
                      sheet.lastExportedAt
                        ? 'bg-green-100 text-green-600'
                        : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {sheet.lastExportedAt ? 'Exported' : 'Draft'}
                  </span>
                </td>
                <td className="p-2 align-middle whitespace-nowrap border-b border-border/70">
                  <span
                    className={cn(
                      'inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium',
                      sheet.lastExportedAt
                        ? 'bg-green-100 text-green-600'
                        : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {sheet.lastExportedAt ? 'Exported' : 'Draft'}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onOpen(sheet.id)}
                    >
                      Open
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="More actions"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() =>
                            handleExportFromHistory(sheet, 'pdf')
                          }
                        >
                          <FileDown className="size-4 mr-2" />
                          Export PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleExportFromHistory(sheet, 'word')
                        }>
                          <FileText className="size-4 mr-2" />
                          Export Word
                        </DropdownMenuItem>
                        {canEditMembers && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(sheet.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="size-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        {choirSheets.length} attendance sheets · newest first
      </p>

      {deleteTarget && (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete attendance sheet?</AlertDialogTitle>
              <AlertDialogDescription>
                Permanently delete {deleteTarget}? Its attendance marks are
                removed and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white"
                onClick={handleDelete}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {exportPreview}
    </section>
  )
}
