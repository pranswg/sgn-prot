import { useMemo, useState } from 'react'
import { CalendarPlus, Eye, Pencil } from 'lucide-react'
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
import { formatDate } from '@/lib/format'

export function SuguanHistoryPage() {
  const suguan = useSuguanStore((s) => s.suguan)
  const openSuguanDetail = useNavStore((s) => s.openSuguanDetail)
  const editSuguanInBuilder = useNavStore((s) => s.editSuguanInBuilder)
  const startNewSuguan = useNavStore((s) => s.startNewSuguan)
  const allServiceTypes = useSettingsStore((s) => s.allServiceTypes)

  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const serviceName = (id: string) =>
    allServiceTypes().find((t) => t.id === id)?.name ?? id

  const allTypes = allServiceTypes()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...suguan]
      .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))
      .filter((s) => {
        if (typeFilter !== 'all' && s.serviceTypeId !== typeFilter) return false
        if (q) {
          const typeName =
            allTypes.find((t) => t.id === s.serviceTypeId)?.name ??
            s.serviceTypeId
          const joined = `${s.date} ${typeName} ${s.location ?? ''}`.toLowerCase()
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
              <TableHead>Service</TableHead>
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
                  <TableCell>{serviceName(s.serviceTypeId)}</TableCell>
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