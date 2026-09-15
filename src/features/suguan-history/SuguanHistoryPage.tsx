import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CalendarPlus, Eye, FileDown, FileSpreadsheet, MoreHorizontal, Pencil } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { exportSuguanExcel, exportSuguanPdf } from '@/lib/suguanExport'
import type { Suguan } from '@/core/types/suguan'

export function SuguanHistoryPage() {
  const suguan = useSuguanStore((s) => s.suguan)
  const openSuguanDetail = useNavStore((s) => s.openSuguanDetail)
  const editSuguanInBuilder = useNavStore((s) => s.editSuguanInBuilder)
  const startNewSuguan = useNavStore((s) => s.startNewSuguan)
  const allServiceTypes = useSettingsStore((s) => s.allServiceTypes)
  const members = useMemberStore((s) => s.members)

  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [exportingId, setExportingId] = useState<string | null>(null)

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

  const recordLabel = (s: Suguan) =>
    s.type === 'special'
      ? s.eventTitle || 'Special Occasion'
      : serviceName(s.serviceTypeId)

  const allTypes = allServiceTypes()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...suguan]
      .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))
      .filter((s) => {
        if (typeFilter !== 'all' && s.serviceTypeId !== typeFilter) return false
        if (q) {
          const label =
            s.type === 'special'
              ? s.eventTitle || 'Special Occasion'
              : allTypes.find((t) => t.id === s.serviceTypeId)?.name ??
                s.serviceTypeId
          const joined = `${s.date} ${label} ${s.location ?? ''}`.toLowerCase()
          if (!joined.includes(q)) return false
        }
        return true
      })
  }, [suguan, query, typeFilter, allTypes])

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Suguan History"
        description={`${suguan.length} total suguan records`}
        actions={
          <Button onClick={startNewSuguan}>
            <CalendarPlus className="size-4" />
            New Suguan
          </Button>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by date, service, location..."
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Service / Event</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No Suguan records found. Create one with the Suguan Builder.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{formatDate(s.date)}</TableCell>
                  <TableCell>{s.time}</TableCell>
                  <TableCell>{recordLabel(s)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.location ?? '—'}
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
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => exportOne(s, 'excel')}>
                            <FileSpreadsheet className="size-4" />
                            Export Excel (.xlsx)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => exportOne(s, 'pdf')}>
                            <FileDown className="size-4" />
                            Export PDF (.pdf)
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
    </div>
  )
}