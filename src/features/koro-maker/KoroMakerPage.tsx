import { useMemo, useState } from 'react'
import {
  ArrowLeftRight,
  Check,
  Eye,
  FileDown,
  Grid2X2,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMemberStore } from '@/store/memberStore'
import { membersOf } from '@/lib/choirs'
import { useSettingsStore } from '@/store/settingsStore'
import { useKoroStore } from '@/store/koroStore'
import { exportFileName } from '@/lib/exportNaming'
import {
  KORO_DEFAULT_ROW_COLUMNS,
  addKoroRow,
  addKoroSeat,
  createKoroTable,
  fillKoroDocument,
  fillKoroTable,
  koroDayLabel,
  koroVoiceColor,
  removeKoroRow,
  removeKoroSeat,
  swapKoroSeats,
} from '@/lib/koro'
import {
  koroDocumentCounts,
  koroPlacedMemberIds,
  koroPlacedSeatLabels,
  koroRosterByVoice,
} from '@/lib/koroLayout'
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
import { KoroTableCard } from './KoroTableCard'
import { KoroLibraryCard } from './KoroLibraryCard'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { memberIsOrganist } from '@/core/constants/memberMembership'
import type { KoroCell, KoroTable } from '@/core/types/koro'
import type { DocFontSize, SuguanGroup } from '@/core/types/suguan'
import { exportKoroAsSuguanPdf } from './koroPdfExport'
import { exportKoroTablePdf } from './koroTablePdfExport'
import { useExportPreview } from '@/hooks/useExportPreview'
import { openPdfPreviewWindow, showPdfPreview } from '@/lib/pdfPreview'
import { useAsyncAction } from '@/hooks/useAsyncAction'

const GROUPS: { value: SuguanGroup; label: string }[] = [
  { value: 'babae', label: 'Babae' },
  { value: 'lalaki', label: 'Lalaki' },
  { value: 'mixed', label: 'Mixed' },
]

export function KoroMakerPage() {
  const allMembers = useMemberStore((state) => state.members)
  // AWS only: a PNK member must never be arranged into an AWS Koro.
  const members = useMemo(() => membersOf(allMembers, 'aws'), [allMembers])
  const voices = useSettingsStore((state) => state.allVoices())
  const dutyRoles = useSettingsStore((state) => state.dutyRoles)
  const localeName = useSettingsStore((state) => state.localeName)
  const documents = useKoroStore((state) => state.documents)
  const activeDocumentId = useKoroStore((state) => state.activeDocumentId)
  const createDocument = useKoroStore((state) => state.createDocument)
  const duplicateDocument = useKoroStore((state) => state.duplicateDocument)
  const selectDocument = useKoroStore((state) => state.selectDocument)
  const updateDocument = useKoroStore((state) => state.updateDocument)
  const deleteDocument = useKoroStore((state) => state.deleteDocument)
  const [exporting, setExporting] = useState<
    'table' | 'suguan' | 'preview' | 'table-preview' | null
  >(null)
  const [memberQuery, setMemberQuery] = useState('')
  const [memberVoice, setMemberVoice] = useState('')
  const [memberGender, setMemberGender] = useState<'all' | 'male' | 'female'>('all')
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [hidePlaced, setHidePlaced] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(
    new Set(),
  )
  const [swapMode, setSwapMode] = useState(false)
  const [swapSource, setSwapSource] = useState<{
    tableId: string
    rowIndex: number
    columnIndex: number
  } | null>(null)
  const { exportPreview, requestExport } = useExportPreview()
  const [createNewKoro, creatingKoro] = useAsyncAction(createDocument)
  const document =
    documents.find((entry) => entry.id === activeDocumentId) ?? documents[0]
  const availableMembers = members.filter((member) => member.isActive)
  const placedMemberIds = document
    ? koroPlacedMemberIds(document)
    : new Set<string>()
  const counts = document ? koroDocumentCounts(document) : null
  const placedSeats = document
    ? koroPlacedSeatLabels(document)
    : new Map<string, string>()
  const rosterByVoice = koroRosterByVoice(availableMembers)
  const unplacedCount = availableMembers.length - placedMemberIds.size
  const selectedCount = selectedMemberIds.size
  // The organist field only offers organist-family members, the same rule the
  // Organist Suguan pickers use.
  const organistCandidates = availableMembers.filter((member) =>
    memberIsOrganist(member, dutyRoles),
  )
  const toggleSelectedMember = (memberId: string) =>
    setSelectedMemberIds((current) => {
      const next = new Set(current)
      if (next.has(memberId)) next.delete(memberId)
      else next.add(memberId)
      return next
    })

  const panelMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    const voiceOrder = new Map(
      voices.map((voice, index) => [voice.id, index] as const),
    )
    return availableMembers
      .filter((member) => {
        if (hidePlaced && placedMemberIds.has(member.id)) return false
        if (memberGender !== 'all' && member.gender !== memberGender)
          return false
        if (memberVoice && member.voicePosition !== memberVoice) return false
        if (q && !`${member.firstName} ${member.lastName}`.toLowerCase().includes(q))
          return false
        return true
      })
      .sort((a, b) => {
        // Voice groups first, in the configured order, then surname — so the
        // panel reads sopranos through bass instead of a flat alphabetical list.
        const left = voiceOrder.get(a.voicePosition) ?? Number.MAX_SAFE_INTEGER
        const right =
          voiceOrder.get(b.voicePosition) ?? Number.MAX_SAFE_INTEGER
        return (
          left - right ||
          a.lastName.localeCompare(b.lastName) ||
          a.firstName.localeCompare(b.firstName)
        )
      })
  }, [
    availableMembers,
    memberQuery,
    memberVoice,
    memberGender,
    hidePlaced,
    placedMemberIds,
    voices,
  ])

  if (!document) return null

  const patchTable = (tableId: string, patch: Partial<KoroTable>) => {
    updateDocument(document.id, {
      tables: document.tables.map((table) =>
        table.id === tableId ? { ...table, ...patch } : table,
      ),
    })
  }

  const updateTable = (
    tableId: string,
    transform: (table: KoroTable) => KoroTable,
  ) => {
    updateDocument(document.id, {
      tables: document.tables.map((table) =>
        table.id === tableId ? transform(table) : table,
      ),
    })
  }

  const patchCell = (
    table: KoroTable,
    rowIndex: number,
    columnIndex: number,
    patch: Partial<KoroCell>,
  ) => {
    const rows = table.rows.map((row, currentRowIndex) =>
      currentRowIndex === rowIndex
        ? {
            ...row,
            cells: row.cells.map((cell, currentColumnIndex) =>
              currentColumnIndex === columnIndex
                ? { ...cell, ...patch }
                : cell,
            ),
          }
        : row,
    )
    patchTable(table.id, { rows })
  }

  const fillTableByVoice = (tableId: string) => {
    const voiceOrder = new Map(voices.map((voice, index) => [voice.id, index]))
    const candidates = availableMembers
      .filter((member) => !placedMemberIds.has(member.id))
      .sort(
        (left, right) =>
          (voiceOrder.get(left.voicePosition) ?? Number.MAX_SAFE_INTEGER) -
            (voiceOrder.get(right.voicePosition) ?? Number.MAX_SAFE_INTEGER) ||
          left.lastName.localeCompare(right.lastName) ||
          left.firstName.localeCompare(right.firstName),
      )
    updateTable(tableId, (table) =>
      fillKoroTable(table, candidates, placedMemberIds),
    )
  }

  const placeSelectedMembers = () => {
    const chosen = availableMembers.filter((member) =>
      selectedMemberIds.has(member.id),
    )
    if (chosen.length === 0) return
    const before = koroDocumentCounts(document).filled
    const next = fillKoroDocument(document, chosen)
    const seatedNow = koroDocumentCounts(next).filled - before
    updateDocument(document.id, { tables: next.tables })
    setSelectedMemberIds(new Set())
    toast.success(
      seatedNow > 0
        ? `Seated ${seatedNow} member${seatedNow === 1 ? '' : 's'}.`
        : 'There were no empty seats to fill.',
    )
  }

  const handleSwapSeat = (
    tableId: string,
    rowIndex: number,
    columnIndex: number,
  ) => {
    if (!swapSource) {
      setSwapSource({ tableId, rowIndex, columnIndex })
      return
    }
    const sameSeat =
      swapSource.rowIndex === rowIndex &&
      swapSource.columnIndex === columnIndex
    if (swapSource.tableId !== tableId || sameSeat) {
      setSwapSource(null)
      return
    }
    updateTable(tableId, (table) =>
      swapKoroSeats(
        table,
        { rowIndex: swapSource.rowIndex, columnIndex: swapSource.columnIndex },
        { rowIndex, columnIndex },
      ),
    )
    setSwapSource(null)
  }

  const dropMember = (
    table: KoroTable,
    rowIndex: number,
    columnIndex: number,
    memberId: string,
  ) => {
    const member = availableMembers.find((entry) => entry.id === memberId)
    if (!member) return
    patchCell(table, rowIndex, columnIndex, {
      memberId: member.id,
      firstName: member.firstName,
      voicePosition: member.voicePosition,
    })
  }

  const addTable = () => {
    const existing = document.tables[0]
    const table = createKoroTable(
      `CHOIR GROUP ${document.tables.length + 1}`,
      existing ? existing.rows.map((row) => row.cells.length) : KORO_DEFAULT_ROW_COLUMNS,
    )
    updateDocument(document.id, { tables: [...document.tables, table] })
  }

  const handleExport = (kind: 'table' | 'suguan') => {
    if (!document.title.trim() || !document.date) {
      toast.error('Enter an occasion title and date before exporting.')
      return
    }
    const title = document.title.trim()
    const fileName =
      kind === 'table'
        ? exportFileName(`${title} - Koro`, 'pdf')
        : exportFileName(`${title} - Suguan`, 'pdf')
    requestExport({
      filename: fileName,
      onConfirm: () => void runExport(kind, fileName),
    })
  }

  const runExport = async (kind: 'table' | 'suguan', fileName: string) => {
    setExporting(kind)
    try {
      if (kind === 'table') {
        await exportKoroTablePdf(document, members, voices, fileName, {
          localeName,
        })
        toast.success('Koro table exported as PDF.')
      } else {
        await exportKoroAsSuguanPdf(document, members, voices, 'download', fileName)
        toast.success('Suguan PDF exported.')
      }
    } catch (error) {
      console.error(error)
      toast.error(kind === 'table' ? 'Could not export the Koro table.' : 'Could not export the Suguan PDF.')
    } finally {
      setExporting(null)
    }
  }

  const handlePreviewTable = async () => {
    if (!document.title.trim() || !document.date) {
      toast.error('Enter an occasion title and date before previewing.')
      return
    }
    const previewWindow = openPdfPreviewWindow()
    if (!previewWindow) {
      toast.error('Allow pop-ups to preview the table.')
      return
    }

    setExporting('table-preview')
    try {
      const pdfBlob = await exportKoroTablePdf(
        document,
        members,
        voices,
        undefined,
        { localeName, output: 'preview' },
      )
      if (!(pdfBlob instanceof Blob)) {
        throw new Error('Koro table preview did not produce a PDF.')
      }
      showPdfPreview(previewWindow, pdfBlob, 'Koro Table')
    } catch (error) {
      previewWindow.close()
      console.error(error)
      toast.error('Could not create the Koro table preview.')
    } finally {
      setExporting(null)
    }
  }

  const handlePreviewSuguan = async () => {
    if (!document.title.trim() || !document.date) {
      toast.error('Enter an occasion title and date before previewing.')
      return
    }
    const previewWindow = openPdfPreviewWindow()
    if (!previewWindow) {
      toast.error('Allow pop-ups to preview the Suguan PDF.')
      return
    }

    setExporting('preview')
    try {
      const pdfBlob = await exportKoroAsSuguanPdf(
        document,
        members,
        voices,
        'preview',
      )
      if (!(pdfBlob instanceof Blob)) {
        throw new Error('Suguan PDF preview did not produce a PDF.')
      }
      showPdfPreview(previewWindow, pdfBlob, 'Koro Suguan')
    } catch (error) {
      previewWindow.close()
      console.error(error)
      toast.error('Could not create the Suguan PDF preview.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      {exportPreview}
      <PageHeader
        title="Koro Maker"
        description="Arrange members by seat and voice color for special occasions. Changes are saved automatically in this browser."
        actions={
          <>
            <Button variant="outline" onClick={createNewKoro} loading={creatingKoro}>
              <Plus className="size-4" />
              New Koro
            </Button>
            <Button
              variant="outline"
              onClick={() => void handlePreviewTable()}
              loading={exporting === 'table-preview'}
              disabled={exporting !== null}
            >
              <Eye className="size-4" />
              Preview Table
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleExport('table')}
              loading={exporting === 'table'}
              disabled={exporting !== null}
            >
              <FileDown className="size-4" />
              Export Table
            </Button>
            <Button
              variant="outline"
              onClick={() => void handlePreviewSuguan()}
              loading={exporting === 'preview'}
              disabled={exporting !== null}
            >
              <Eye className="size-4" />
              Preview Suguan
            </Button>
            <Button
              onClick={() => void handleExport('suguan')}
              loading={exporting === 'suguan'}
              disabled={exporting !== null}
            >
              <FileDown className="size-4" />
              Export as Suguan
            </Button>
          </>
        }
      />

      <KoroLibraryCard
        documents={documents}
        activeId={document.id}
        onSelect={selectDocument}
        onDuplicate={duplicateDocument}
      />

      <section className="grid gap-4 rounded-xl border border-border/70 bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor="koro-title">Occasion title</Label>
          <Input
            id="koro-title"
            value={document.title}
            onChange={(event) =>
              updateDocument(document.id, { title: event.target.value })
            }
            placeholder="Anniversary Thanksgiving"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="koro-date">Date</Label>
          <Input
            id="koro-date"
            type="date"
            value={document.date}
            onChange={(event) => {
              const date = event.target.value
              updateDocument(document.id, {
                date,
                serviceDay: koroDayLabel(date),
              })
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="koro-service-time">Service time</Label>
          <Input
            id="koro-service-time"
            value={document.serviceTime ?? ''}
            onChange={(event) =>
              updateDocument(document.id, { serviceTime: event.target.value })
            }
            placeholder="6:00AM"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="koro-group">Choir group</Label>
          <Select
            value={document.group}
            onValueChange={(value) =>
              updateDocument(document.id, { group: value as SuguanGroup })
            }
          >
            <SelectTrigger id="koro-group" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUPS.map((group) => (
                <SelectItem key={group.value} value={group.value}>
                  {group.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="koro-export-font-size">Export font size</Label>
          <Select
            value={document.exportFontSize ?? 'large'}
            onValueChange={(value) =>
              updateDocument(document.id, {
                exportFontSize: value as Exclude<DocFontSize, 'custom'>,
              })
            }
          >
            <SelectTrigger id="koro-export-font-size" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small — fit more names</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="large">Large — easier to read</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="koro-organist">Organist</Label>
          <Select
            value={document.organistMemberId || 'none'}
            onValueChange={(value) =>
              updateDocument(document.id, {
                organistMemberId: value === 'none' ? '' : value,
              })
            }
          >
            <SelectTrigger id="koro-organist" className="h-9 w-full">
              <SelectValue placeholder="Select organist" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No organist</SelectItem>
              {organistCandidates.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.lastName.trim()
                    ? `${member.lastName.trim()}, ${member.firstName.trim()}`
                    : member.firstName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 sm:col-span-2 xl:col-span-4">
          <p className="max-w-prose text-xs text-muted-foreground">
            {documents.length <= 1
              ? 'A Koro is always kept open, so the last one cannot be deleted.'
              : 'Deleting a Koro removes it from this browser and the shared database.'}
          </p>
          <Button
            type="button"
            variant="outline"
            className="text-destructive"
            disabled={documents.length <= 1}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            Delete Koro
          </Button>
        </div>
      </section>

      {counts && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border/70 bg-card px-4 py-3 text-xs">
          <span className="font-medium tabular-nums">
            {counts.filled} of {counts.seats} seats filled
          </span>
          <span className="text-muted-foreground tabular-nums">
            {counts.empty} empty
          </span>
          {counts.duplicatedMemberIds.length > 0 && (
            <span className="font-medium text-amber-700 dark:text-amber-400">
              {counts.duplicatedMemberIds.length} seated twice
            </span>
          )}
          <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
            {voices.map((voice) => (
              <span key={voice.id} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-3 rounded-sm border border-black/20"
                  style={{ backgroundColor: koroVoiceColor(voice.id, voices) }}
                />
                {voice.shortName}
                <span className="text-muted-foreground tabular-nums">
                  {counts.byVoice[voice.id] ?? 0}/{rosterByVoice[voice.id] ?? 0}
                </span>
              </span>
            ))}
          </span>
          <Button
            type="button"
            variant={swapMode ? 'secondary' : 'outline'}
            size="sm"
            aria-pressed={swapMode}
            onClick={() => {
              setSwapMode((current) => !current)
              setSwapSource(null)
            }}
          >
            <ArrowLeftRight className="size-4" />
            {swapMode ? 'Exit swap' : 'Swap seats'}
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {/* KORO_GRID */}
          {document.tables.map((table, tableIndex) => (
            <KoroTableCard
              key={table.id}
              table={table}
              tableIndex={tableIndex}
              canRemoveTable={document.tables.length > 1}
              members={availableMembers}
              voices={voices}
              placedSeats={placedSeats}
              dropTarget={dropTarget}
              swapMode={swapMode}
              swapSource={
                swapSource?.tableId === table.id
                  ? {
                      rowIndex: swapSource.rowIndex,
                      columnIndex: swapSource.columnIndex,
                    }
                  : null
              }
              onSwapSeat={(rowIndex, columnIndex) =>
                handleSwapSeat(table.id, rowIndex, columnIndex)
              }
              onFillByVoice={() => fillTableByVoice(table.id)}
              onTitleChange={(title) => patchTable(table.id, { title })}
              onAddRow={() => updateTable(table.id, addKoroRow)}
              onAddSeat={(rowId) =>
                updateTable(table.id, (current) => addKoroSeat(current, rowId))
              }
              onRemoveSeat={(rowId) =>
                updateTable(table.id, (current) =>
                  removeKoroSeat(current, rowId),
                )
              }
              onRemoveRow={(rowId) =>
                updateTable(table.id, (current) =>
                  removeKoroRow(current, rowId),
                )
              }
              onRemoveTable={() =>
                updateDocument(document.id, {
                  tables: document.tables.filter(
                    (entry) => entry.id !== table.id,
                  ),
                })
              }
              onSeatSelect={(rowIndex, columnIndex, member) =>
                patchCell(table, rowIndex, columnIndex, {
                  memberId: member?.id ?? null,
                  firstName: member?.firstName ?? '',
                  voicePosition: member?.voicePosition ?? '',
                })
              }
              onDropSeat={(rowIndex, columnIndex, memberId) =>
                dropMember(table, rowIndex, columnIndex, memberId)
              }
              onDragSeatChange={setDropTarget}
            />
          ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={addTable}>
          <Grid2X2 className="size-4" />
          Add another table
        </Button>
        <p className="max-w-prose text-xs text-muted-foreground">
          Voice colours print with the chart, so the seating stays readable on
          paper.
        </p>
      </div>

      {availableMembers.length === 0 && (
            <p className="rounded-lg border border-amber-300/60 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
              Add or reactivate choir members in the Master List before arranging a Koro.
            </p>
          )}
        </div>

        <aside className="sticky top-4 z-10 w-full shrink-0 rounded-xl border border-border/70 bg-card p-4 xl:w-80">
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="koro-member-search">Members</Label>
              <span className="text-xs text-muted-foreground">
                {panelMembers.length} of {availableMembers.length}
              </span>
            </div>
            <Input
              id="koro-member-search"
              value={memberQuery}
              onChange={(event) => setMemberQuery(event.target.value)}
              placeholder="Search by name"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Filter members by choir"
                value={memberGender}
                onChange={(event) =>
                  setMemberGender(event.target.value as 'all' | 'male' | 'female')
                }
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="all">All</option>
                <option value="female">Women</option>
                <option value="male">Men</option>
              </select>
              <select
                aria-label="Filter members by voice"
                value={memberVoice}
                onChange={(event) => setMemberVoice(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">All voices</option>
                {voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.shortName} — {voice.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant={hidePlaced ? 'secondary' : 'outline'}
              size="sm"
              aria-pressed={hidePlaced}
              onClick={() => setHidePlaced((current) => !current)}
              className="justify-between"
            >
              Unplaced only
              <span className="text-xs text-muted-foreground tabular-nums">
                {unplacedCount}
              </span>
            </Button>
          </div>
          <div className="mt-3 max-h-[60vh] space-y-1 overflow-y-auto pr-1">
            {panelMembers.map((member) => {
              const placed = placedMemberIds.has(member.id)
              const voiceShort =
                voices.find((voice) => voice.id === member.voicePosition)
                  ?.shortName ?? ''
              return (
                <div
                  key={member.id}
                  draggable
                  title={`${member.firstName} ${member.lastName}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedMemberIds.has(member.id)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/plain', member.id)
                    event.dataTransfer.effectAllowed = 'copy'
                  }}
                  onClick={() => toggleSelectedMember(member.id)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    toggleSelectedMember(member.id)
                  }}
                  className={`flex cursor-grab items-center gap-2 rounded-md border px-2 py-1.5 text-sm transition-opacity ${
                    selectedMemberIds.has(member.id)
                      ? 'border-primary bg-primary/10'
                      : placed
                        ? 'border-border/60 bg-muted/60 opacity-50'
                        : 'border-border bg-background hover:border-primary/50 hover:bg-muted/50 active:cursor-grabbing'
                  }`}
                >
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-sm border border-black/20"
                    style={{
                      backgroundColor: koroVoiceColor(member.voicePosition, voices),
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {member.firstName} {member.lastName}
                  </span>
                  {voiceShort && (
                    <span className="shrink-0 text-[0.7rem] text-muted-foreground">
                      {voiceShort}
                    </span>
                  )}
                  {selectedMemberIds.has(member.id) && (
                    <Check className="size-4 shrink-0 text-primary" />
                  )}
                  {placed && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      placed
                    </span>
                  )}
                </div>
              )
            })}
            {panelMembers.length === 0 && (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                No members match these filters.
              </p>
            )}
          </div>
          <Button
            type="button"
            className="mt-2 w-full"
            disabled={selectedCount === 0}
            onClick={placeSelectedMembers}
          >
            Place selected members
            {selectedCount > 0 && (
              <span className="tabular-nums">({selectedCount})</span>
            )}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Tap a name to select it, then place it into the empty seats. You can
            also drag a name onto a seat. Already-placed seats are dimmed.
          </p>
        </aside>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Koro?</AlertDialogTitle>
            <AlertDialogDescription>
              {`“${document.title || 'Untitled Koro'}” and its seating arrangement will be removed. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white"
              onClick={() => {
                setDeleteOpen(false)
                deleteDocument(document.id)
              }}
            >
              Delete Koro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
