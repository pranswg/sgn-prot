import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CalendarPlus,
  Eye,
  FileDown,
  FileSpreadsheet,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useSuguanStore } from '@/store/suguanStore'
import { useNavStore } from '@/store/navStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useMemberStore } from '@/store/memberStore'
import { formatDate } from '@/lib/format'
import { exportSuguanExcel } from '@/lib/suguanExport'
import { exportSuguanPdf } from '@/features/suguan-builder/suguanPdfExport'
import type { Suguan } from '@/core/types/suguan'

export function SuguanHistoryPage() {
  const suguan = useSuguanStore((s) => s.suguan)
  const deleteSuguan = useSuguanStore((s) => s.deleteSuguan)
  const deleteMany = useSuguanStore((s) => s.deleteMany)
  const clearHistory = useSuguanStore((s) => s.clear)
  const openSuguanDetail = useNavStore((s) => s.openSuguanDetail)
  const editSuguanInBuilder = useNavStore((s) => s.editSuguanInBuilder)
  const startNewSuguan = useNavStore((s) => s.startNewSuguan)
  const allServiceTypes = useSettingsStore((s) => s.allServiceTypes)
  const members = useMemberStore((s) => s.members)

  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteTargets, setDeleteTargets] = useState<Suguan[] | null>(null)
  const [clearOpen, setClearOpen] = useState(false)

  const confirmDelete = () => {
    if (!deleteTargets || deleteTargets.length === 0) return
    const ids = deleteTargets.map((s) => s.id)
    if (ids.length === 1) deleteSuguan(ids[0])
    else deleteMany(ids)
    toast.success(
      ids.length === 1
        ? `Suguan on ${formatDate(deleteTargets[0].date)} deleted from history.`
        : `${ids.length} Suguan records deleted from history.`,
    )
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)))
    setDeleteTargets(null)
  }

  const confirmClear = () => {
    clearHistory()
    toast.success('Suguan history cleared.')
    setClearOpen(false)
  }

  const exportOne = async (
    suguanRecord: Suguan,
    kind: 'excel' | 'pdf',
  ) => {
    setExportingId(suguanRecord.id)
    try {
      if (kind === 'excel')
        await exportSuguanExcel(suguanRecord, members, suguanRecord.docFormat)
      else await exportSuguanPdf(suguanRecord, members, suguanRecord.docFormat)
      toast.success('SUGUAN sheet exported.')
    } catch (err) {
      console.error(err)
      toast.error('Could not export the SUGUAN sheet.')
    } finally {
      setExportingId(null)
    }
  }

  const serviceName = (id: string) =>
    allServiceTypes().find((t) => t.id === id)?.name ?? id

  const recordLabel = (s: Suguan) => serviceName(s.serviceTypeId)

  const allTypes = allServiceTypes()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...suguan]
      .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))
      .filter((s) => {
        if (typeFilter !== 'all' && s.serviceTypeId !== typeFilter) return false
        if (q) {
          const label =
            allTypes.find((t) => t.id === s.serviceTypeId)?.name ??
            s.serviceTypeId
          const joined = `${s.date} ${label}`.toLowerCase()
          if (!joined.includes(q)) return false
        }
        return true
      })
  }, [suguan, query, typeFilter, allTypes])

  const allSelected = filtered.length > 0 && filtered.every((s) => selectedIds.includes(s.id))

  const toggleRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const toggleAll = () => {
    const visibleIds = filtered.map((s) => s.id)
    setSelectedIds((prev) =>
      allSelected
        ? prev.filter((id) => !visibleIds.includes(id))
        : [...new Set([...prev, ...visibleIds])],
    )
  }

  const selectedRecords = filtered.filter((s) => selectedIds.includes(s.id))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Suguan History"
        description={`${suguan.length} total suguan records`}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setClearOpen(true)}
              disabled={suguan.length === 0}
            >
              <Trash2 className="size-4" />
              Clear history
            </Button>
            <Button onClick={startNewSuguan}>
              <CalendarPlus className="size-4" />
              New Suguan
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by date or service..."
          className="flex-1"
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Service" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Services</SelectItem>
            {allServiceTypes().map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
          <span className="text-sm text-muted-foreground">
            {selectedIds.length} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
              Deselect all
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteTargets(selectedRecords)}
              disabled={selectedRecords.length === 0}
            >
              <Trash2 className="size-4" />
              Delete selected
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Select all Suguans"
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  disabled={filtered.length === 0}
                />
              </TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No Suguan records found. Create one with the Suguan Builder.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Select Suguan on ${formatDate(s.date)}`}
                      checked={selectedIds.includes(s.id)}
                      onCheckedChange={() => toggleRow(s.id)}
                    />
                  </TableCell>
                  <TableCell>{formatDate(s.date)}</TableCell>
                  <TableCell>{s.time}</TableCell>
                  <TableCell>{recordLabel(s)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.group === 'babae'
                      ? 'Babae'
                      : s.group === 'lalaki'
                        ? 'Lalaki'
                        : 'Mixed'}
                  </TableCell>
                  <TableCell>{s.assignments.length}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => editSuguanInBuilder(s.id)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openSuguanDetail(s.id)}
                      >
                        <Eye className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteTargets([s])}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={exportingId === s.id}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => exportOne(s, 'excel')}>
                            <FileSpreadsheet className="size-4" />
                            Export Excel (.xlsx)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => exportOne(s, 'pdf')}>
                            <FileDown className="size-4" />
                            Export PDF (.pdf)
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTargets([s])}
                          >
                            <Trash2 className="size-4" />
                            Delete from history
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={!!deleteTargets}
        onOpenChange={(o) => !o && setDeleteTargets(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTargets && deleteTargets.length === 1
                ? 'Delete this Suguan?'
                : `Delete ${deleteTargets?.length ?? 0} Suguans?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTargets && deleteTargets.length === 1
                ? `${formatDate(deleteTargets[0].date)} — ${recordLabel(deleteTargets[0])}. This will permanently remove the record from history.`
                : `This permanently deletes ${deleteTargets?.length ?? 0} Suguan records, including their rosters, duty roles, and document settings. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all Suguan history?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes all {suguan.length} Suguan record
              {suguan.length === 1 ? '' : 's'}, including their rosters, duty
              roles, and document settings. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmClear}
            >
              Clear history
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}