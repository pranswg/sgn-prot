import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowUpRight,
  GraduationCap,
  Pencil,
  Plus,
  Search,
  UserRoundX,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMemberStore } from '@/store/memberStore'
import type { Trainee } from '@/core/types/member'
import { getVoiceName } from '@/core/constants/voicePositions'
import { useSettingsStore } from '@/store/settingsStore'
import { formatDate } from '@/lib/format'
import { GenderBadge, TraineeStatusBadge } from '@/components/StatusBadges'
import { TraineeFormDialog } from './TraineeFormDialog'

export function TraineePage() {
  const trainees = useMemberStore((s) => s.trainees)
  const promoteTrainee = useMemberStore((s) => s.promoteTrainee)
  const removeTrainee = useMemberStore((s) => s.removeTrainee)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const voices = allVoices()

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Trainee | null>(null)
  const [promoteTarget, setPromoteTarget] = useState<Trainee | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Trainee | null>(null)

  const activeTrainees = trainees.filter(
    (t) => t.status === 'active' || t.status === 'inactive',
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return activeTrainees
      .filter((t) => {
        if (statusFilter !== 'all' && t.status !== statusFilter) return false
        if (q && !`${t.firstName} ${t.lastName}`.toLowerCase().includes(q))
          return false
        return true
      })
      .sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
      )
  }, [activeTrainees, query, statusFilter])

  const handlePromote = () => {
    if (!promoteTarget) return
    const member = promoteTrainee(promoteTarget.id)
    if (member) {
      toast.success(
        `${promoteTarget.firstName} ${promoteTarget.lastName} promoted to choir member.`,
      )
    }
    setPromoteTarget(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Nagsasanay / Trainees"
        description="Manage prospective choir members. Active trainees are not eligible for Suguan assignments."
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus className="size-4" />
            Add Trainee
          </Button>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search trainees..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Voice Position</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Date Added</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No trainees to display.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium">
                      {t.firstName} {t.lastName}
                    </div>
                  </TableCell>
                  <TableCell>
                    <GenderBadge gender={t.gender} />
                  </TableCell>
                  <TableCell>{getVoiceName(t.voicePosition, voices)}</TableCell>
                  <TableCell>
                    <TraineeStatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {formatDate(t.dateAdded)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setPromoteTarget(t)}
                        disabled={t.status !== 'active'}
                      >
                        <ArrowUpRight className="size-3.5" />
                        Promote
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditing(t)
                          setFormOpen(true)
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-red-600 hover:text-red-600"
                        onClick={() => setRemoveTarget(t)}
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
        {filtered.length} active trainee record{filtered.length === 1 ? '' : 's'}
        {trainees.some((t) => t.status === 'promoted') &&
          ` • ${trainees.filter((t) => t.status === 'promoted').length} promoted`}
      </p>

      <TraineeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        trainee={editing}
      />

      <AlertDialog open={!!promoteTarget} onOpenChange={(o) => !o && setPromoteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promote trainee?</AlertDialogTitle>
            <AlertDialogDescription>
              Promote {promoteTarget?.firstName} {promoteTarget?.lastName} to a
              regular choir member? The trainee record will be preserved and the
              person's history will be kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePromote}>
              <GraduationCap className="mr-1 size-4" />
              Promote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove trainee?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {removeTarget?.firstName} {removeTarget?.lastName}? This
              cannot be undone. Consider deactivating instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white"
              onClick={() => {
                if (removeTarget) {
                  removeTrainee(removeTarget.id)
                  toast.success('Trainee removed.')
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