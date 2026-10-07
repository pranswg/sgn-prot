import { useMemo, useState } from 'react'
import { Eye, FileDown, Grid2X2, Minus, Plus, Rows3, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMemberStore } from '@/store/memberStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useKoroStore } from '@/store/koroStore'
import {
  KORO_DEFAULT_COLUMNS,
  KORO_DEFAULT_ROW_COLUMNS,
  createKoroCell,
  createKoroRow,
  createKoroTable,
  koroDayLabel,
  koroVoiceColor,
} from '@/lib/koro'
import type { KoroCell, KoroTable } from '@/core/types/koro'
import type { DocFontSize, SuguanGroup } from '@/core/types/suguan'
import { exportKoroAsSuguanPdf, exportKoroTablePdf } from './koroPdfExport'

const GROUPS: { value: SuguanGroup; label: string }[] = [
  { value: 'babae', label: 'Babae' },
  { value: 'lalaki', label: 'Lalaki' },
  { value: 'mixed', label: 'Mixed' },
]

export function KoroMakerPage() {
  const members = useMemberStore((state) => state.members)
  const voices = useSettingsStore((state) => state.allVoices())
  const documents = useKoroStore((state) => state.documents)
  const activeDocumentId = useKoroStore((state) => state.activeDocumentId)
  const createDocument = useKoroStore((state) => state.createDocument)
  const selectDocument = useKoroStore((state) => state.selectDocument)
  const updateDocument = useKoroStore((state) => state.updateDocument)
  const deleteDocument = useKoroStore((state) => state.deleteDocument)
  const [exporting, setExporting] = useState<'table' | 'suguan' | 'preview' | null>(null)
  const [memberQuery, setMemberQuery] = useState('')
  const [memberVoice, setMemberVoice] = useState('')
  const [memberGender, setMemberGender] = useState<'all' | 'male' | 'female'>('all')
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const document =
    documents.find((entry) => entry.id === activeDocumentId) ?? documents[0]
  const availableMembers = members.filter((member) => member.isActive)

  const panelMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    return availableMembers
      .filter((member) => {
        if (memberGender !== 'all' && member.gender !== memberGender)
          return false
        if (memberVoice && member.voicePosition !== memberVoice) return false
        if (q && !`${member.firstName} ${member.lastName}`.toLowerCase().includes(q))
          return false
        return true
      })
      .sort(
        (a, b) =>
          a.lastName.localeCompare(b.lastName) ||
          a.firstName.localeCompare(b.firstName),
      )
  }, [availableMembers, memberQuery, memberVoice, memberGender])

  if (!document) return null

  const patchTable = (tableId: string, patch: Partial<KoroTable>) => {
    updateDocument(document.id, {
      tables: document.tables.map((table) =>
        table.id === tableId ? { ...table, ...patch } : table,
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

  const placedMemberIds = new Set(
    document.tables
      .flatMap((table) => table.rows.flatMap((row) => row.cells))
      .map((cell) => cell.memberId)
      .filter((id): id is string => Boolean(id)),
  )

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

  const handleExport = async (kind: 'table' | 'suguan') => {
    if (!document.title.trim() || !document.date) {
      toast.error('Enter an occasion title and date before exporting.')
      return
    }
    setExporting(kind)
    try {
      if (kind === 'table') {
        await exportKoroTablePdf(document, members, voices)
        toast.success('Koro table exported as PDF.')
      } else {
        await exportKoroAsSuguanPdf(document, members, voices)
        toast.success('Suguan PDF exported.')
      }
    } catch (error) {
      console.error(error)
      toast.error(kind === 'table' ? 'Could not export the Koro table.' : 'Could not export the Suguan PDF.')
    } finally {
      setExporting(null)
    }
  }

  const handlePreviewSuguan = async () => {
    if (!document.title.trim() || !document.date) {
      toast.error('Enter an occasion title and date before previewing.')
      return
    }
    const previewWindow = window.open('', '_blank')
    if (!previewWindow) {
      toast.error('Allow pop-ups to preview the Suguan PDF.')
      return
    }

    setExporting('preview')
    let pdfUrl: string | null = null
    let viewerUrl: string | null = null
    try {
      const pdfBlob = await exportKoroAsSuguanPdf(document, members, voices, 'preview')
      if (!(pdfBlob instanceof Blob)) {
        throw new Error('Suguan PDF preview did not produce a PDF.')
      }

      pdfUrl = URL.createObjectURL(pdfBlob)
      const previewTitle = document.title.replace(/[&<>"]/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
      })[character] ?? character)
      const viewerHtml = `<!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>${previewTitle} - Suguan Preview</title>
            <style>
              html, body, iframe { width: 100%; height: 100%; margin: 0; border: 0; }
              body { overflow: hidden; }
            </style>
          </head>
          <body>
            <iframe title="Suguan PDF preview" src="${pdfUrl}"></iframe>
            <script>
              window.addEventListener('pagehide', () => {
                URL.revokeObjectURL(${JSON.stringify(pdfUrl)})
                URL.revokeObjectURL(location.href)
              }, { once: true })
            </script>
          </body>
        </html>`
      viewerUrl = URL.createObjectURL(
        new Blob([viewerHtml], { type: 'text/html' }),
      )
      previewWindow.location.replace(viewerUrl)
    } catch (error) {
      previewWindow.close()
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
      if (viewerUrl) URL.revokeObjectURL(viewerUrl)
      console.error(error)
      toast.error('Could not create the Suguan PDF preview.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader
        title="Koro Maker"
        description="Arrange members by seat and voice color for special occasions. Changes are saved automatically in this browser."
        actions={
          <>
            <Button variant="outline" onClick={createDocument}>
              <Plus className="size-4" />
              New Koro
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleExport('table')}
              disabled={exporting !== null}
            >
              <FileDown className="size-4" />
              Export Table
            </Button>
            <Button
              variant="outline"
              onClick={() => void handlePreviewSuguan()}
              disabled={exporting !== null}
            >
              <Eye className="size-4" />
              Preview Suguan
            </Button>
            <Button
              onClick={() => void handleExport('suguan')}
              disabled={exporting !== null}
            >
              <FileDown className="size-4" />
              Export as Suguan
            </Button>
          </>
        }
      />

      <section className="grid gap-4 rounded-xl border border-border/70 bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor="koro-document">Saved Koro</Label>
          <select
            id="koro-document"
            value={document.id}
            onChange={(event) => selectDocument(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {documents.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title || 'Untitled Koro'} — {entry.date || 'No date'}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={documents.length <= 1}
            onClick={() => {
              if (window.confirm(`Delete "${document.title || 'Untitled Koro'}"?`)) {
                deleteDocument(document.id)
              }
            }}
          >
            <Trash2 className="size-4" />
            Delete Koro
          </Button>
        </div>
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
          <select
            id="koro-group"
            value={document.group}
            onChange={(event) =>
              updateDocument(document.id, {
                group: event.target.value as SuguanGroup,
              })
            }
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {GROUPS.map((group) => (
              <option key={group.value} value={group.value}>
                {group.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="koro-export-font-size">Export font size</Label>
          <select
            id="koro-export-font-size"
            value={document.exportFontSize ?? 'large'}
            onChange={(event) =>
              updateDocument(document.id, {
                exportFontSize: event.target.value as Exclude<DocFontSize, 'custom'>,
              })
            }
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="small">Small — fit more names</option>
            <option value="normal">Normal</option>
            <option value="large">Large — easier to read</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="koro-organist">Organist</Label>
          <select
            id="koro-organist"
            value={document.organistMemberId ?? ''}
            onChange={(event) =>
              updateDocument(document.id, {
                organistMemberId: event.target.value,
              })
            }
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Select organist</option>
            {availableMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.firstName}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {document.tables.map((table, tableIndex) => {
            const columnCount = table.rows[0]?.cells.length ?? 0
        return (
          <section
            key={table.id}
            className="rounded-xl border border-border/70 bg-card p-4"
          >
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div className="grid min-w-48 flex-1 gap-2">
                <Label htmlFor={`koro-table-title-${table.id}`}>
                  Table {tableIndex + 1} title
                </Label>
                <Input
                  id={`koro-table-title-${table.id}`}
                  value={table.title}
                  onChange={(event) =>
                    patchTable(table.id, { title: event.target.value })
                  }
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    patchTable(table.id, {
                      rows: [
                        ...table.rows,
                        createKoroRow(columnCount || KORO_DEFAULT_COLUMNS),
                      ],
                    })
                  }
                >
                  <Rows3 className="size-4" />
                  Add row
                </Button>
                {document.tables.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove table ${tableIndex + 1}`}
                    title="Remove table"
                    onClick={() =>
                      updateDocument(document.id, {
                        tables: document.tables.filter(
                          (entry) => entry.id !== table.id,
                        ),
                      })
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full border-collapse">
                <tbody>
                  {table.rows.map((row, rowIndex) => (
                    <tr key={row.id}>
                      {row.cells.map((cell, columnIndex) => {
                        const assignedMember = availableMembers.find(
                          (member) => member.id === cell.memberId,
                        )
                        const colorVoice =
                          cell.voicePosition || assignedMember?.voicePosition || ''
                        return (
                          <td
                            key={`${table.id}:${rowIndex}:${columnIndex}`}
                            onDragOver={(event) => {
                              event.preventDefault()
                              setDropTarget(`${table.id}:${rowIndex}:${columnIndex}`)
                            }}
                            onDragLeave={() =>
                              setDropTarget((current) =>
                                current === `${table.id}:${rowIndex}:${columnIndex}`
                                  ? null
                                  : current,
                              )
                            }
                            onDrop={(event) => {
                              event.preventDefault()
                              setDropTarget(null)
                              dropMember(
                                table,
                                rowIndex,
                                columnIndex,
                                event.dataTransfer.getData('text/plain'),
                              )
                            }}
                            className={`min-w-32 border p-1.5 align-top transition-colors ${
                              dropTarget === `${table.id}:${rowIndex}:${columnIndex}`
                                ? 'border-primary bg-primary/5'
                                : 'border-border'
                            }`}
                            style={{
                              backgroundColor: cell.memberId
                                ? koroVoiceColor(colorVoice, voices)
                                : '#ffffff',
                            }}
                          >
                            <select
                              aria-label={`Row ${rowIndex + 1}, seat ${columnIndex + 1} member`}
                              value={cell.memberId ?? ''}
                              onChange={(event) => {
                                const member = availableMembers.find(
                                  (entry) => entry.id === event.target.value,
                                )
                                patchCell(table, rowIndex, columnIndex, {
                                  memberId: member?.id ?? null,
                                  firstName: member?.firstName ?? '',
                                  voicePosition: member?.voicePosition ?? '',
                                })
                              }}
                              className="h-9 w-full rounded-md border border-black/20 bg-white/90 px-2 text-sm text-black"
                            >
                              <option value="">Choose member</option>
                              {availableMembers.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.lastName.trim()
                                    ? `${member.lastName.trim()}, ${member.firstName.trim()}`
                                    : member.firstName}
                                </option>
                              ))}
                            </select>
                            {cell.memberId && (
                              <select
                                aria-label={`Row ${rowIndex + 1}, seat ${columnIndex + 1} voice arrangement`}
                                value={cell.voicePosition}
                                onChange={(event) =>
                                  patchCell(table, rowIndex, columnIndex, {
                                    voicePosition: event.target.value,
                                  })
                                }
                                className="mt-1 h-7 w-full rounded-md border border-black/20 bg-white/90 px-1 text-xs text-black"
                              >
                                <option value="">Member voice</option>
                                {voices.map((voice) => (
                                  <option key={voice.id} value={voice.id}>
                                    {voice.shortName}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                        )
                      })}
                      <td className="w-10 border border-border p-1 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Add seat to row ${rowIndex + 1}`}
                            title="Add seat"
                            onClick={() =>
                              patchTable(table.id, {
                                rows: table.rows.map((entry) =>
                                  entry.id === row.id
                                    ? {
                                        ...entry,
                                        cells: [...entry.cells, createKoroCell()],
                                      }
                                    : entry,
                                ),
                              })
                            }
                            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Plus className="size-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove seat from row ${rowIndex + 1}`}
                            title="Remove seat"
                            disabled={row.cells.length <= 1}
                            onClick={() =>
                              patchTable(table.id, {
                                rows: table.rows.map((entry) =>
                                  entry.id === row.id
                                    ? {
                                        ...entry,
                                        cells: entry.cells.slice(0, -1),
                                      }
                                    : entry,
                                ),
                              })
                            }
                            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-40"
                          >
                            <Minus className="size-4" />
                          </button>
                          {table.rows.length > 1 && (
                            <button
                              type="button"
                              aria-label={`Remove row ${rowIndex + 1}`}
                              title="Remove row"
                              onClick={() =>
                                patchTable(table.id, {
                                  rows: table.rows.filter(
                                    (entry) => entry.id !== row.id,
                                  ),
                                })
                              }
                              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={addTable}>
          <Grid2X2 className="size-4" />
          Add another table
        </Button>
        <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-border/70 bg-card px-3 py-2">
          {voices.map((voice) => (
            <span key={voice.id} className="inline-flex items-center gap-1.5 text-xs">
              <span
                aria-hidden
                className="size-3 rounded-sm border border-black/20"
                style={{ backgroundColor: koroVoiceColor(voice.id, voices) }}
              />
              {voice.shortName} — {voice.name}
            </span>
          ))}
        </div>
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
          </div>
          <div className="mt-3 max-h-[60vh] space-y-1 overflow-y-auto pr-1">
            {panelMembers.map((member) => {
              const placed = placedMemberIds.has(member.id)
              return (
                <div
                  key={member.id}
                  draggable
                  title={`${member.firstName} ${member.lastName}`}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/plain', member.id)
                    event.dataTransfer.effectAllowed = 'copy'
                  }}
                  className={`flex cursor-grab items-center gap-2 rounded-md border px-2 py-1.5 text-sm transition-opacity ${
                    placed
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
          <p className="mt-3 text-xs text-muted-foreground">
            Drag a name onto a seat to place it. Already-placed seats are dimmed.
          </p>
        </aside>
      </div>
    </div>
  )
}
