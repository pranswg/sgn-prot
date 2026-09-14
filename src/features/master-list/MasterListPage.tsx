import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Download,
  Eye,
  Pencil,
  Plus,
  Search,
  UserRoundX,
} from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { useMemberStore } from '@/store/memberStore'
import type { Member } from '@/core/types/member'
import { getVoiceName } from '@/core/constants/voicePositions'
import { useSettingsStore } from '@/store/settingsStore'
import { formatDate } from '@/lib/format'
import { GenderBadge, MemberStatusBadge } from '@/components/StatusBadges'
import { MemberFormDialog } from './MemberFormDialog'
import { MemberDetailDialog } from './MemberDetailDialog'
import { exportCSV, exportExcel, membersToRows } from '@/lib/export'

type GenderFilter = 'all' | 'female' | 'male'
type VoiceFilter = 'all' | string
type StatusFilter = 'all' | 'active' | 'inactive'

export function MasterListPage() {
  const members = useMemberStore((s) => s.members)
  const removeMember = useMemberStore((s) => s.removeMember)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const voices = allVoices()

  const [query, setQuery] = useState('')
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all')
  const [voiceFilter, setVoiceFilter] = useState<VoiceFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [formOpen, setFormOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [viewingMember, setViewingMember] = useState<Member | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null)

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase()
    return members
      .filter((m) => {
        if (genderFilter !== 'all' && m.gender !== genderFilter) return false
        if (voiceFilter !== 'all' && m.voicePosition !== voiceFilter) return false
        if (statusFilter === 'active' && !m.isActive) return false
        if (statusFilter === 'inactive' && m.isActive) return false
        if (q) {
          const name = `${m.firstName} ${m.lastName}`.toLowerCase()
          if (!name.includes(q)) return false
        }
        return true
      })
      .sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
      )
  }, [members, query, genderFilter, voiceFilter, statusFilter])

  const filteredCount = filteredMembers.length
  const totalCount = members.length

  const openAddDialog = () => {
    setEditingMember(null)
    setFormOpen(true)
  }

  const openEditDialog = (member: Member) => {
    setEditingMember(member)
    setFormOpen(true)
  }

  const handleExport = async (format: 'csv' | 'excel') => {
    if (filteredCount === 0) {
      toast.error('No members to export.')
      return
    }
    const rows = membersToRows(filteredMembers) as unknown as Record<string, string | number>[]
    const suffix = `${genderFilter === 'all' ? 'all' : genderFilter}${
      query.trim() ? '-filtered' : ''
    }`
    const filename = `master-list-${suffix}-${new Date().toISOString().slice(0, 10)}`
    try {
      if (format === 'csv') {
        exportCSV(rows, `${filename}.csv`)
      } else {
        await exportExcel(rows, `${filename}.xlsx`)
      }
      toast.success(`Exported ${filteredCount} members as ${format.toUpperCase()}.`)
    } catch {
      toast.error('Export failed.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Master List"
        description={`${totalCount} members in the choir registry.`}
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="size-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Export current view</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleExport('csv')}>
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('excel')}>
                  Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={openAddDialog}>
              <Plus className="size-4" />
              Add Member
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={genderFilter}
            onValueChange={(v) => setGenderFilter(v as GenderFilter)}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genders</SelectItem>
              <SelectItem value="female">Women's Choir</SelectItem>
              <SelectItem value="male">Men's Choir</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={voiceFilter}
            onValueChange={(v) => setVoiceFilter(v as VoiceFilter)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Voice" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Voices</SelectItem>
              {voices.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Voice Position</TableHead>
              <TableHead>Membership</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Date Added</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {members.length === 0
                    ? 'No members yet. Click "Add Member" to begin.'
                    : 'No members match the current filters.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="font-medium">
                      {m.firstName} {m.lastName}
                    </div>
                  </TableCell>
                  <TableCell>
                    <GenderBadge gender={m.gender} />
                  </TableCell>
                  <TableCell>{getVoiceName(m.voicePosition, voices)}</TableCell>
                  <TableCell className="capitalize">{m.membershipType}</TableCell>
                  <TableCell>
                    <MemberStatusBadge active={m.isActive} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {formatDate(m.dateAdded)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setViewingMember(m)}
                      >
                        <Eye className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEditDialog(m)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setRemoveTarget(m)}
                        className="text-red-600 hover:text-red-600"
                      >
                        <UserRoundX className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {filteredCount} of {totalCount} members.
      </p>

      <MemberFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        member={editingMember}
        onSaved={() => setViewingMember(null)}
      />

      <MemberDetailDialog
        member={viewingMember}
        onOpenChange={(open) => {
          if (!open) setViewingMember(null)
        }}
        onEdit={() => viewingMember && openEditDialog(viewingMember)}
      />

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {removeTarget?.firstName} {removeTarget?.lastName} from the
              Master List? This cannot be undone. Consider deactivating instead to
              preserve history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white"
              onClick={() => {
                if (removeTarget) {
                  removeMember(removeTarget.id)
                  toast.success('Member removed.')
                  setRemoveTarget(null)
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}