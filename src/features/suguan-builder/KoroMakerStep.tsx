import {
  useMemo,
  useState,
  type DragEvent,
} from 'react'
import { toast } from 'sonner'
import {
  Download,
  Image as ImageIcon,
  LayoutGrid,
  Minus,
  Plus,
  Save,
  Trash2,
  Wand2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSettingsStore } from '@/store/settingsStore'
import { useFormationStore } from '@/store/formationStore'
import { getVoiceName } from '@/core/constants/voicePositions'
import { formatDateLong, formatTime } from '@/lib/format'
import { exportKoroPng, exportKoroPdf, koroVoiceColor } from '@/lib/koro'
import type { SuguanFormationCell, SuguanFormation } from '@/core/types/suguan'
import type { Member } from '@/core/types/member'
import type { SuguanDraft } from './builderState'
import { cn } from '@/lib/utils'

interface KoroMakerStepProps {
  draft: SuguanDraft
  patch: (p: Partial<SuguanDraft>) => void
  members: Member[]
}

const DEFAULT_ROWS = 4
const DEFAULT_COLS = 5

function emptyGrid(rows: number, cols: number): SuguanFormation {
  return { rows, cols, cells: Array(rows * cols).fill(null) }
}

export function KoroMakerStep({ draft, patch, members }: KoroMakerStepProps) {
  const allVoices = useSettingsStore((s) => s.allVoices)
  const voices = allVoices()
  const templates = useFormationStore((s) => s.templates)
  const saveTemplate = useFormationStore((s) => s.saveTemplate)
  const deleteTemplate = useFormationStore((s) => s.deleteTemplate)

  const base = useMemo<SuguanFormation>(
    () => draft.formation ?? emptyGrid(DEFAULT_ROWS, DEFAULT_COLS),
    [draft.formation],
  )

  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null)

  const setCell = (r: number, c: number, cell: SuguanFormationCell | null) => {
    const arr = [...base.cells]
    arr[r * base.cols + c] = cell
    patch({ formation: { ...base, cells: arr } })
  }

  const resize = (nr: number, nc: number) => {
    const arr: (SuguanFormationCell | null)[] = Array(nr * nc).fill(null)
    for (let r = 0; r < Math.min(nr, base.rows); r++) {
      for (let c = 0; c < Math.min(nc, base.cols); c++) {
        const src = r * base.cols + c
        if (src < base.cells.length && base.cells[src]) {
          arr[r * nc + c] = base.cells[src]
        }
      }
    }
    patch({ formation: { rows: nr, cols: nc, cells: arr } })
  }

  const memberCell = (a: SuguanDraft['assignments'][number]): SuguanFormationCell => ({
    memberId: a.memberId,
    memberName: a.memberName,
    voicePosition: a.voicePosition,
    voiceName: getVoiceName(a.voicePosition, voices),
  })

  const autoArrange = () => {
    if (draft.assignments.length === 0) {
      toast.error('Assign members in the previous step first.')
      return
    }
    const grouped = new Map<string, SuguanDraft['assignments']>()
    for (const a of draft.assignments) {
      const list = grouped.get(a.voicePosition) ?? []
      list.push(a)
      grouped.set(a.voicePosition, list)
    }
    const ordered: SuguanDraft['assignments'] = []
    for (const v of voices) {
      ordered.push(...(grouped.get(v.id) ?? []))
    }
    const cells: (SuguanFormationCell | null)[] = Array(
      base.rows * base.cols,
    ).fill(null)
    ordered.forEach((a, i) => {
      if (i < cells.length) cells[i] = memberCell(a)
    })
    patch({ formation: { rows: base.rows, cols: base.cols, cells } })
    toast.success(
      ordered.length <= cells.length
        ? 'Members auto-arranged into the grid.'
        : `Auto-arranged. ${
            ordered.length - cells.length
          } member(s) did not fit — increase the grid size.`,
    )
  }

  const placedIds = useMemo(
    () => new Set(base.cells.filter(Boolean).map((c) => c!.memberId)),
    [base.cells],
  )
  const unplaced = draft.assignments.filter(
    (a) => !placedIds.has(a.memberId),
  )

  const startDrag = (
    e: DragEvent,
    a: SuguanDraft['assignments'][number],
  ) => {
    e.dataTransfer.setData('application/x-choir-member', JSON.stringify(a))
    e.dataTransfer.effectAllowed = 'move'
  }

  const startCellDrag = (e: DragEvent, cell: SuguanFormationCell) => {
    e.dataTransfer.setData('application/x-choir-member', JSON.stringify(cell))
    e.dataTransfer.effectAllowed = 'move'
  }

  const onDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const onDrop = (e: DragEvent, r: number, c: number) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData('application/x-choir-member')
    if (!raw) return
    try {
      const data = JSON.parse(raw)
      if (data?.memberId) {
        setCell(r, c, {
          memberId: data.memberId,
          memberName: data.memberName,
          voicePosition: data.voicePosition,
          voiceName: data.voiceName ?? getVoiceName(data.voicePosition, voices),
        })
      }
    } catch {
      /* ignore malformed drag payload */
    }
  }

  const memberName = (memberId: string) =>
    members.find((m) => m.id === memberId)?.firstName ?? ''

  const voiceLabels = useMemo(() => {
    const m: Record<string, string> = {}
    for (const v of voices) m[v.id] = v.shortName
    return m
  }, [voices])

  const exportBase = useMemo(
    () => ({
      title: draft.eventTitle.trim() || 'Choir Formation',
      subtitle: `${formatDateLong(draft.date)}${
        draft.time ? ` • ${formatTime(draft.time)}` : ''
      } • ${base.rows}×${base.cols} grid`,
      voiceLabels,
      docFormat: draft.docFormat,
      fileName: `Koro_${
        draft.eventTitle.trim().replace(/\s+/g, '_') || draft.date
      }`,
    }),
    [draft.eventTitle, draft.date, draft.time, base.rows, base.cols, voiceLabels, draft.docFormat],
  )

  const handleExportPng = async () => {
    if (!base.cells.some(Boolean)) {
      toast.error('The grid is empty. Place members first.')
      return
    }
    setExporting('png')
    try {
      await exportKoroPng({ formation: base, ...exportBase })
      toast.success('Koro formation exported as image (.png).')
    } catch (err) {
      console.error(err)
      toast.error('Could not export the Koro image.')
    } finally {
      setExporting(null)
    }
  }

  const handleExportPdf = async () => {
    if (!base.cells.some(Boolean)) {
      toast.error('The grid is empty. Place members first.')
      return
    }
    setExporting('pdf')
    try {
      await exportKoroPdf({ formation: base, ...exportBase })
      toast.success('Koro formation exported as PDF.')
    } catch (err) {
      console.error(err)
      toast.error('Could not export the Koro PDF.')
    } finally {
      setExporting(null)
    }
  }

  const handleSaveTemplate = () => {
    if (!base.cells.some(Boolean)) {
      toast.error('The grid is empty. Place members first.')
      return
    }
    const name = saveName.trim() || `Koro ${base.rows}×${base.cols}`
    saveTemplate(name, base)
    setSaveOpen(false)
    setSaveName('')
    toast.success(`Formation template "${name}" saved.`)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Koro Maker</h2>
        <p className="text-sm text-muted-foreground">
          Arrange assigned members into rows and columns. Drag members from the
          palette into the grid, drag to move, hover a placed member to remove.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                <LayoutGrid className="size-4 text-primary" />
                Formation Grid
                <Badge variant="outline" className="ml-auto">
                  {base.rows} rows × {base.cols} cols
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Rows
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => resize(Math.max(2, base.rows - 1), base.cols)}
                    disabled={base.rows <= 2}
                  >
                    <Minus className="size-3.5" />
                  </Button>
                  <span className="w-8 text-center text-sm font-semibold">
                    {base.rows}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => resize(Math.min(10, base.rows + 1), base.cols)}
                    disabled={base.rows >= 10}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Cols
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => resize(base.rows, Math.max(2, base.cols - 1))}
                    disabled={base.cols <= 2}
                  >
                    <Minus className="size-3.5" />
                  </Button>
                  <span className="w-8 text-center text-sm font-semibold">
                    {base.cols}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => resize(base.rows, Math.min(8, base.cols + 1))}
                    disabled={base.cols >= 8}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={autoArrange}>
                  <Wand2 className="size-4" />
                  Auto Arrange
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    patch({ formation: emptyGrid(base.rows, base.cols) })
                  }
                >
                  <Trash2 className="size-4" />
                  Clear
                </Button>
              </div>

              <div
                className="overflow-x-auto pb-2"
                style={{ maxHeight: 440, overflowY: 'auto' }}
              >
                <div
                  className="grid min-w-max gap-2"
                  style={{
                    gridTemplateColumns: `repeat(${base.cols}, minmax(84px, 1fr))`,
                  }}
                >
                  {Array.from({ length: base.rows * base.cols }, (_, i) => {
                    const cell = base.cells[i]
                    const r = Math.floor(i / base.cols)
                    const c = i % base.cols
                    return (
                      <div
                        key={i}
                        draggable={!!cell}
                        onDragStart={
                          cell ? (e) => startCellDrag(e, cell) : undefined
                        }
                        onDragOver={onDragOver}
                        onDrop={(e) => onDrop(e, r, c)}
                        className={cn(
                          'relative flex h-16 min-w-[84px] items-center justify-center rounded-lg border-2 px-1 text-center select-none',
                          cell
                            ? 'cursor-grab'
                            : 'border-dashed border-muted-foreground/30 hover:border-primary/50',
                        )}
                        style={
                          cell
                            ? { borderColor: koroVoiceColor(cell.voicePosition) }
                            : undefined
                        }
                      >
                        {cell ? (
                          <>
                            <span className="px-1 text-xs font-semibold leading-tight">
                              {cell.memberName}
                            </span>
                            <button
                              type="button"
                              onClick={() => setCell(r, c, null)}
                              className="absolute right-0.5 top-0.5 rounded p-0.5 text-muted-foreground/50 hover:bg-muted hover:text-red-600"
                              title="Remove from grid"
                            >
                              <X className="size-3.5" />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">
                            +
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {templates.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">
                  Saved Formations
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm"
                  >
                    <span className="font-medium">
                      {t.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {t.rows}×{t.cols}
                      </span>
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          patch({
                            formation: {
                              rows: t.rows,
                              cols: t.cols,
                              cells: t.cells.map((c) =>
                                c
                                  ? {
                                      memberId: c.memberId,
                                      memberName: c.memberName,
                                      voicePosition: c.voicePosition,
                                      voiceName: c.voiceName,
                                    }
                                  : null,
                              ),
                            },
                          })
                        }
                      >
                        Load
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-red-600"
                        onClick={() => {
                          deleteTemplate(t.id)
                          toast.success('Formation template deleted.')
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Members to Place
                <Badge variant="outline" className="ml-2">
                  {unplaced.length} left
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {draft.assignments.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No members assigned yet. Go back to the Assignments step.
                </p>
              )}
              {voices.map((v) => {
                const list = unplaced.filter(
                  (a) => a.voicePosition === v.id,
                )
                if (list.length === 0) return null
                return (
                  <div key={v.id} className="space-y-1">
                    <p
                      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      style={{ color: koroVoiceColor(v.id) }}
                    >
                      <span
                        className="inline-block size-2 rounded-full"
                        style={{ backgroundColor: koroVoiceColor(v.id) }}
                      />
                      {v.shortName} ({list.length})
                    </p>
                    <div className="flex flex-col gap-1">
                      {list.map((a) => (
                        <div
                          key={`${a.memberId}-${a.voicePosition}`}
                          draggable
                          onDragStart={(e) => startDrag(e, a)}
                          className="cursor-grab rounded-md border border-muted-foreground/20 bg-card px-2.5 py-1.5 text-sm font-medium hover:bg-accent active:cursor-grabbing"
                          title="Drag into the grid"
                        >
                          {a.memberName || memberName(a.memberId)}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              {draft.assignments.length > 0 && unplaced.length === 0 && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  All assigned members have been placed.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Export</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Select
                value=""
                onValueChange={(val) => {
                  if (val) {
                    const t = templates.find((x) => x.id === val)
                    if (t) {
                      patch({
                        formation: {
                          rows: t.rows,
                          cols: t.cols,
                          cells: t.cells.map((c) =>
                            c
                              ? {
                                  memberId: c.memberId,
                                  memberName: c.memberName,
                                  voicePosition: c.voicePosition,
                                  voiceName: c.voiceName,
                                }
                              : null,
                          ),
                        },
                      })
                      toast.success(`Loaded template "${t.name}".`)
                    }
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Load a template…" />
                </SelectTrigger>
                <SelectContent>
                  {templates.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No saved templates
                    </SelectItem>
                  ) : (
                    templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={handleExportPng} disabled={exporting !== null}>
                  <ImageIcon className="size-4" />
                  PNG
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting !== null}>
                  <Download className="size-4" />
                  PDF
                </Button>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setSaveOpen(true)}>
                <Save className="size-4" />
                Save as Template
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save Formation Template</DialogTitle>
          </DialogHeader>
          <Input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder={`e.g. Koro ${base.rows}×${base.cols}`}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate}>
              <Save className="size-4" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}