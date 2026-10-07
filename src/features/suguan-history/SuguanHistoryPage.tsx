import { useState } from 'react'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useSuguanStore } from '@/store/suguanStore'
import { useOrganistaSuguanStore } from '@/store/organistaSuguanStore'
import { useNavStore } from '@/store/navStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useMemberStore } from '@/store/memberStore'
import { formatDate } from '@/lib/format'
import { exportSuguanExcel } from '@/lib/suguanExport'
import { exportSuguanPdf } from '@/features/suguan-builder/suguanPdfExport'
import { buildOrganistaSuguanPdf } from '@/features/organista-suguan-maker/OrganistaSuguanMakerPage'
import { organistaDateLabel } from '@/features/organista-suguan-maker/organistaDateLabel'
import {
  DEFAULT_MEMBER_PAGE_SIZE,
  MEMBER_PAGE_SIZES,
  paginate,
  type MemberPageSize,
} from '@/lib/memberDirectory'
import { SectionPaginator } from '@/features/master-list/SectionPaginator'
import type { Suguan } from '@/core/types/suguan'
import type { OrganistaSuguanRecord } from '@/core/types/organistaSuguan'

const ORGANISTA_FILTER = 'organista-suguan'

type HistoryItem =
  | { kind: 'suguan'; key: string; record: Suguan }
  | { kind: 'organista'; key: string; record: OrganistaSuguanRecord }

function createdAtDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date)
}

function createdAtTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }).format(date)
}

function HistoryPageSizeControl({
  value,
  onChange,
}: {
  value: MemberPageSize
  onChange: (size: MemberPageSize) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[0.6875rem] text-muted-foreground">
        Rows to show
      </span>
      <div
        role="group"
        aria-label="History records per page"
        className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5"
      >
        {MEMBER_PAGE_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            aria-pressed={value === size}
            onClick={() => onChange(size)}
            className={`h-7 min-w-8 rounded-md px-2 text-xs font-medium tabular-nums transition-colors ${
              value === size
                ? 'bg-brand-navy-soft text-brand-navy'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SuguanHistoryPage() {
  const suguan = useSuguanStore((state) => state.suguan)
  const deleteSuguan = useSuguanStore((state) => state.deleteSuguan)
  const deleteManySuguan = useSuguanStore((state) => state.deleteMany)
  const clearSuguanHistory = useSuguanStore((state) => state.clear)
  const organistaRecords = useOrganistaSuguanStore((state) => state.records)
  const deleteOrganistaRecord = useOrganistaSuguanStore(
    (state) => state.deleteRecord,
  )
  const deleteManyOrganistaRecords = useOrganistaSuguanStore(
    (state) => state.deleteMany,
  )
  const clearOrganistaHistory = useOrganistaSuguanStore((state) => state.clear)
  const openSuguanDetail = useNavStore((state) => state.openSuguanDetail)
  const editSuguanInBuilder = useNavStore((state) => state.editSuguanInBuilder)
  const startNewSuguan = useNavStore((state) => state.startNewSuguan)
  const allServiceTypes = useSettingsStore((state) => state.allServiceTypes)
  const members = useMemberStore((state) => state.members)

  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteTargets, setDeleteTargets] = useState<HistoryItem[] | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [viewingOrganista, setViewingOrganista] =
    useState<OrganistaSuguanRecord | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] =
    useState<MemberPageSize>(DEFAULT_MEMBER_PAGE_SIZE)

  const allTypes = allServiceTypes()
  const serviceName = (id: string) =>
    allTypes.find((service) => service.id === id)?.name ?? id
  const historyItems: HistoryItem[] = [
    ...suguan.map((record) => ({
      kind: 'suguan' as const,
      key: `suguan:${record.id}`,
      record,
    })),
    ...organistaRecords.map((record) => ({
      kind: 'organista' as const,
      key: `organista:${record.id}`,
      record,
    })),
  ]
  const q = query.trim().toLowerCase()
  const filtered = [...historyItems]
    .sort((a, b) => b.record.createdAt.localeCompare(a.record.createdAt))
    .filter((item) => {
      if (
        typeFilter === ORGANISTA_FILTER
          ? item.kind !== 'organista'
          : typeFilter !== 'all' &&
            (item.kind !== 'suguan' || item.record.serviceTypeId !== typeFilter)
      ) {
        return false
      }
      if (!q) return true
      const searchText =
        item.kind === 'suguan'
          ? `${item.record.date} ${
              allTypes.find(
                (service) => service.id === item.record.serviceTypeId,
              )?.name ?? item.record.serviceTypeId
            }`
          : `${item.record.pagsasanayDate} Organist Suguan ${item.record.churchName}`
      return searchText.toLowerCase().includes(q)
    })

  const page = paginate(filtered, pageNumber, pageSize)
  const allSelected =
    filtered.length > 0 && filtered.every((item) => selectedIds.includes(item.key))
  const selectedRecords = filtered.filter((item) =>
    selectedIds.includes(item.key),
  )

  const toggleRow = (key: string) => {
    setSelectedIds((previous) =>
      previous.includes(key)
        ? previous.filter((item) => item !== key)
        : [...previous, key],
    )
  }

  const toggleAll = () => {
    const filteredKeys = filtered.map((item) => item.key)
    setSelectedIds((previous) =>
      allSelected
        ? previous.filter((key) => !filteredKeys.includes(key))
        : [...new Set([...previous, ...filteredKeys])],
    )
  }

  const confirmDelete = () => {
    if (!deleteTargets?.length) return
    const suguanTargets = deleteTargets.filter(
      (item): item is Extract<HistoryItem, { kind: 'suguan' }> =>
        item.kind === 'suguan',
    )
    const organistaTargets = deleteTargets.filter(
      (item): item is Extract<HistoryItem, { kind: 'organista' }> =>
        item.kind === 'organista',
    )
    if (suguanTargets.length === 1) deleteSuguan(suguanTargets[0].record.id)
    else if (suguanTargets.length > 1) {
      deleteManySuguan(suguanTargets.map((item) => item.record.id))
    }
    if (organistaTargets.length === 1) {
      deleteOrganistaRecord(organistaTargets[0].record.id)
    } else if (organistaTargets.length > 1) {
      deleteManyOrganistaRecords(organistaTargets.map((item) => item.record.id))
    }
    const deletedKeys = new Set(deleteTargets.map((item) => item.key))
    setSelectedIds((previous) => previous.filter((key) => !deletedKeys.has(key)))
    toast.success(
      deleteTargets.length === 1
        ? 'Suguan record deleted from history.'
        : `${deleteTargets.length} records deleted from history.`,
    )
    setDeleteTargets(null)
  }

  const confirmClear = () => {
    clearSuguanHistory()
    clearOrganistaHistory()
    setSelectedIds([])
    toast.success('Suguan history cleared.')
    setClearOpen(false)
  }

  const exportSuguan = async (record: Suguan, kind: 'excel' | 'pdf') => {
    setExportingId(`suguan:${record.id}`)
    try {
      if (kind === 'excel')
        await exportSuguanExcel(record, members, record.docFormat)
      else await exportSuguanPdf(record, members, record.docFormat)
      toast.success('SUGUAN sheet exported.')
    } catch (error) {
      console.error(error)
      toast.error('Could not export the SUGUAN sheet.')
    } finally {
      setExportingId(null)
    }
  }

  const exportOrganista = async (record: OrganistaSuguanRecord) => {
    setExportingId(`organista:${record.id}`)
    try {
      const blob = await buildOrganistaSuguanPdf(
        record.churchName,
        record.pagsasanayDate,
        record.services,
        record.docFormat,
        record.pangulongMangaawitName,
        record.destinadoName,
      )
      const fileUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = fileUrl
      link.download = `${(record.churchName || 'Sta-Monica')
        .trim()
        .replace(/\s+/g, '-')
        .toUpperCase()}-Organista-Suguan.pdf`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000)
      toast.success('Organist Suguan PDF exported.')
    } catch (error) {
      console.error(error)
      toast.error('Could not export the Organist Suguan PDF.')
    } finally {
      setExportingId(null)
    }
  }

  const organistaGroup = (record: OrganistaSuguanRecord) => {
    const names = record.services.flatMap((service) =>
      [service.organist, service.reserve]
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean),
    )
    if (names.length === 0) return '—'
    const assignedMembers = names.map((name) =>
      members.find(
        (member) =>
          `${member.firstName} ${member.lastName}`.trim().toLowerCase() ===
          name,
      ),
    )
    const genders = new Set<'male' | 'female'>()
    for (const member of assignedMembers) {
      if (!member) return '—'
      genders.add(member.gender)
    }
    if (genders.size === 0) return '—'
    if (genders.size > 1) return 'Mixed'
    return genders.has('female') ? 'Babae' : 'Lalaki'
  }

  const assignedCount = (item: HistoryItem) =>
    item.kind === 'suguan'
      ? item.record.assignments.length
      : item.record.services.reduce(
          (count, service) =>
            count +
            Number(Boolean(service.organist.trim())) +
            Number(Boolean(service.reserve.trim())),
          0,
        )

  const historyService = (item: HistoryItem) =>
    item.kind === 'suguan'
      ? serviceName(item.record.serviceTypeId)
      : 'Organist Suguan'

  const historyGroup = (item: HistoryItem) =>
    item.kind === 'suguan'
      ? item.record.group === 'babae'
        ? 'Babae'
        : item.record.group === 'lalaki'
          ? 'Lalaki'
          : 'Mixed'
      : organistaGroup(item.record)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Suguan History"
        description={`${historyItems.length} total suguan records`}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setClearOpen(true)}
              disabled={historyItems.length === 0}
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
          onChange={(event) => {
            setQuery(event.target.value)
            setPageNumber(1)
          }}
          placeholder="Search by date or service..."
          className="flex-1"
        />
        <Select
          value={typeFilter}
          onValueChange={(value) => {
            setTypeFilter(value)
            setPageNumber(1)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Service" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Services</SelectItem>
            {allTypes.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {service.name}
              </SelectItem>
            ))}
            <SelectItem value={ORGANISTA_FILTER}>Organist Suguan</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <HistoryPageSizeControl
          value={pageSize}
          onChange={(size) => {
            setPageSize(size)
            setPageNumber(1)
          }}
        />
        <span className="text-xs text-muted-foreground">
          Select all applies to the filtered results.
        </span>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
          <span className="text-sm text-muted-foreground">
            {selectedRecords.length} selected
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
                  aria-label="Select all filtered Suguan records"
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  disabled={filtered.length === 0}
                />
              </TableHead>
              <TableHead>Date Created</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead className="w-36 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No Suguan records found. Create one with the Choir Suguan or
                  Organist Suguan.
                </TableCell>
              </TableRow>
            ) : (
              page.items.map((item) => (
                <TableRow key={item.key}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ${historyService(item)} created ${createdAtDate(item.record.createdAt)}`}
                      checked={selectedIds.includes(item.key)}
                      onCheckedChange={() => toggleRow(item.key)}
                    />
                  </TableCell>
                  <TableCell>{createdAtDate(item.record.createdAt)}</TableCell>
                  <TableCell>{createdAtTime(item.record.createdAt)}</TableCell>
                  <TableCell>{historyService(item)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {historyGroup(item)}
                  </TableCell>
                  <TableCell>{assignedCount(item)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {item.kind === 'suguan' ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Edit Suguan"
                            onClick={() => editSuguanInBuilder(item.record.id)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="View Suguan"
                            onClick={() => openSuguanDetail(item.record.id)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="More Suguan actions"
                                disabled={exportingId === item.key}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem
                                onClick={() => void exportSuguan(item.record, 'excel')}
                              >
                                <FileSpreadsheet className="size-4" />
                                Export Excel (.xlsx)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => void exportSuguan(item.record, 'pdf')}
                              >
                                <FileDown className="size-4" />
                                Export PDF (.pdf)
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeleteTargets([item])}
                              >
                                <Trash2 className="size-4" />
                                Delete from history
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="View Organist Suguan details"
                            onClick={() => setViewingOrganista(item.record)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Export Organist Suguan PDF"
                            disabled={exportingId === item.key}
                            onClick={() => void exportOrganista(item.record)}
                          >
                            <FileDown className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Delete Organist Suguan"
                            onClick={() => setDeleteTargets([item])}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <SectionPaginator
        label="history records"
        page={page}
        onPageChange={setPageNumber}
      />

      <AlertDialog
        open={!!deleteTargets}
        onOpenChange={(open) => !open && setDeleteTargets(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTargets?.length === 1
                ? 'Delete this Suguan record?'
                : `Delete ${deleteTargets?.length ?? 0} records?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected record
              {deleteTargets?.length === 1 ? '' : 's'} from history. This action
              cannot be undone.
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
              This permanently deletes all {historyItems.length} Suguan and
              Organist Suguan records. This action cannot be undone.
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

      <Dialog
        open={!!viewingOrganista}
        onOpenChange={(open) => !open && setViewingOrganista(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Organist Suguan</DialogTitle>
            <DialogDescription>
              {viewingOrganista?.churchName} · Pagsasanay{' '}
              {viewingOrganista
                ? formatDate(viewingOrganista.pagsasanayDate)
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {viewingOrganista
                ? organistaDateLabel(viewingOrganista.pagsasanayDate)
                : ''}
            </p>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Organista</TableHead>
                    <TableHead>Reserba</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewingOrganista?.services.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell>{service.heading}</TableCell>
                      <TableCell>{service.organist || '—'}</TableCell>
                      <TableCell>{service.reserve || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              Saved {viewingOrganista ? createdAtDate(viewingOrganista.createdAt) : ''}
              {' · '}
              {viewingOrganista?.pangulongMangaawitName || 'Pangulong Mang-aawit not set'}
              {' · '}
              {viewingOrganista?.destinadoName || 'Destinado not set'}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
