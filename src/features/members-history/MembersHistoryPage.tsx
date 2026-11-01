import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArchiveRestore, Search, X } from 'lucide-react'
import { MobileDirectoryHeader } from '@/components/MobileDirectoryHeader'
import { PageHeader } from '@/components/PageHeader'
import {
  MemberLifecycleBadge,
  ReturnedMemberBadge,
} from '@/components/StatusBadges'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { usePermissions } from '@/hooks/usePermissions'
import { useMemberStore } from '@/store/memberStore'
import { useNavStore } from '@/store/navStore'
import { useSidebarStore } from '@/store/sidebarStore'
import type { Choir, Member } from '@/core/types/member'
import { CHOIR_LABELS, membersOf } from '@/lib/choirs'
import {
  EMPTY_HISTORY_FILTERS,
  filterMemberHistory,
  type HistoryStatusFilter,
} from '@/lib/memberHistoryFilter'
import {
  belongsInMemberHistory,
  memberHistoryYears,
  memberIsReturned,
  memberLifecycleStatus,
  memberMembershipSummary,
} from '@/lib/memberHistory'
import {
  buildMemberReferences,
  formatMemberName,
  memberInitials,
} from '@/lib/memberDirectory'
import { MemberHistoryDialog } from './MemberHistoryDetail'
import {
  MemberLifecycleDialog,
  type LifecycleFormKind,
} from './MemberLifecycleForm'
import { HistoryRowActions } from './HistoryRowActions'

/** Members who can be brought back to the active list with one action. */
function isRestorable(member: Member): boolean {
  const status = memberLifecycleStatus(member)
  return status === 'transferred-out' || status === 'inactive'
}

interface HistoryCardProps {
  member: Member
  reference?: string
  canRestore: boolean
  canDelete: boolean
  onView: (member: Member) => void
  onRestore: (member: Member) => void
  onDelete: (member: Member) => void
}

/** Compact phone card: tap it for the timeline, or use the row menu. */
function HistoryCard({
  member,
  reference,
  canRestore,
  canDelete,
  onView,
  onRestore,
  onDelete,
}: HistoryCardProps) {
  return (
    <li className="pressable relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm motion-reduce:transform-none">
      <button
        type="button"
        onClick={() => onView(member)}
        aria-label={`View history for ${formatMemberName(member)}`}
        className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      />
      <div className="pointer-events-none relative flex items-start gap-3 p-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-teal-soft text-[0.8125rem] font-semibold tracking-tight text-brand-teal">
          {memberInitials(member)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 leading-tight">
              <p className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-foreground">
                <span className="truncate">{formatMemberName(member)}</span>
                {memberIsReturned(member) && <ReturnedMemberBadge />}
              </p>
              <p className="mt-0.5 text-[0.6875rem] tabular-nums text-muted-foreground">
                {reference ?? '—'}
              </p>
              <p className="mt-1.5 truncate text-[0.6875rem] text-muted-foreground">
                {memberMembershipSummary(member)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <MemberLifecycleBadge member={member} />
              <span className="pointer-events-auto">
                <HistoryRowActions
                  member={member}
                  canRestore={canRestore}
                  canDelete={canDelete}
                  onView={onView}
                  onRestore={onRestore}
                  onDelete={onDelete}
                />
              </span>
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}

const COLUMN_HEAD = 'text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground'

export function MembersHistoryPage({ choir = 'aws' }: { choir?: Choir }) {
  const allMembers = useMemberStore((s) => s.members)
  // The archive is per choir: a PNK member transferred out never appears in the
  // AWS archive, and restoring here restores them into the same choir.
  const members = useMemo(
    () => membersOf(allMembers, choir),
    [allMembers, choir],
  )
  const removeMember = useMemberStore((s) => s.removeMember)
  const setMobileDrawerOpen = useSidebarStore((s) => s.setMobileDrawerOpen)
  const { can } = usePermissions()
  const canManage = can('manage-membership-history')
  const canDeleteMembers = can('delete-members')

  const [filters, setFilters] = useState(EMPTY_HISTORY_FILTERS)
  const [historyTarget, setHistoryTarget] = useState<Member | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null)
  const [lifecycle, setLifecycle] = useState<{
    member: Member
    kind: LifecycleFormKind
  } | null>(null)

  // The duplicate-detection dialog can direct the user straight to a member's
  // timeline ("View History"). The one-shot flag is consumed on mount so a
  // later plain navigation cannot re-open the dialog.
  useEffect(() => {
    const pendingId = useNavStore.getState().consumeSelectedHistoryMemberId()
    if (pendingId) {
      const pending = members.find((member) => member.id === pendingId)
      if (pending) setHistoryTarget(pending)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const references = useMemo(() => buildMemberReferences(members), [members])
  // The archive only holds members who have ever transferred out, so the year
  // filter and the "nothing here yet" state read from it rather than the full
  // roster (which still contains active and plain-inactive members).
  const archivedMembers = useMemo(
    () => members.filter(belongsInMemberHistory),
    [members],
  )
  const years = useMemo(
    () => memberHistoryYears(archivedMembers),
    [archivedMembers],
  )
  const historyMembers = useMemo(
    () => filterMemberHistory(archivedMembers, filters),
    [archivedMembers, filters],
  )
  const setFilter = <K extends keyof typeof filters>(
    key: K,
    value: (typeof filters)[K],
  ) => setFilters((f) => ({ ...f, [key]: value }))

  const requestRestore = (member: Member) => {
    setHistoryTarget(null)
    setLifecycle({ member, kind: 'restore' })
  }

  const body =
    archivedMembers.length === 0 ? (
      <div className="flex min-h-72 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ArchiveRestore className="size-5" />
        </span>
        <p className="text-sm font-medium text-foreground">
          No membership history yet
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Once a member is transferred out or restored, their journey shows up
          here.
        </p>
      </div>
    ) : historyMembers.length === 0 ? (
      <div className="flex min-h-72 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ArchiveRestore className="size-5" />
        </span>
        <p className="text-sm font-medium text-foreground">
          No members match these filters
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilters(EMPTY_HISTORY_FILTERS)}
        >
          Reset filters
        </Button>
      </div>
    ) : (
      <div className="flex flex-col gap-3">
        <ul className="flex flex-col gap-2 md:hidden">
          {historyMembers.map((member) => (
            <HistoryCard
              key={member.id}
              member={member}
              reference={references.get(member.id)}
              canRestore={isRestorable(member) && canManage}
              canDelete={canDeleteMembers}
              onView={setHistoryTarget}
              onRestore={requestRestore}
              onDelete={setDeleteTarget}
            />
          ))}
        </ul>

        <div className="hidden min-w-0 max-w-full overflow-x-auto rounded-xl border border-border/70 bg-card md:block">
          <Table className="min-w-[48rem]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${COLUMN_HEAD} w-14 text-center`}>#</TableHead>
                <TableHead className={COLUMN_HEAD}>Member</TableHead>
                <TableHead className={COLUMN_HEAD}>Status</TableHead>
                <TableHead className={COLUMN_HEAD}>Membership Period</TableHead>
                <TableHead className={`${COLUMN_HEAD} w-24 text-right`}>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyMembers.map((member, index) => (
                <TableRow
                  key={member.id}
                  className="h-14 border-b border-border transition-colors hover:bg-background"
                >
                  <TableCell className="w-14 text-center align-middle">
                    <span className="inline-flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-teal-soft text-[0.6875rem] font-semibold tracking-tight text-brand-teal">
                        {memberInitials(member)}
                      </span>
                      <div className="min-w-0 leading-tight">
                        <p className="truncate text-[0.8125rem] font-semibold text-foreground">
                          {formatMemberName(member)}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[0.6875rem] tabular-nums text-muted-foreground">
                          {references.get(member.id) ?? '—'}
                          {memberIsReturned(member) && <ReturnedMemberBadge />}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <MemberLifecycleBadge member={member} />
                  </TableCell>
                  <TableCell>
                    <span className="text-[0.8125rem] text-foreground">
                      {memberMembershipSummary(member)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <HistoryRowActions
                      member={member}
                      canRestore={isRestorable(member) && canManage}
                      canDelete={canDeleteMembers}
                      showView
                      onView={setHistoryTarget}
                      onRestore={requestRestore}
                      onDelete={setDeleteTarget}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )

  return (
    <div className="flex w-full min-w-0 flex-col gap-5">
      <MobileDirectoryHeader
        title={`${CHOIR_LABELS[choir]} Members History`}
        description={`${archivedMembers.length} in the archive`}
        onOpenMenu={() => setMobileDrawerOpen(true)}
      />

      <PageHeader
        title={`${CHOIR_LABELS[choir]} Members History`}
        description="Members who transferred out or returned."
        className="hidden md:flex"
      />

      <div className="sticky top-14 z-20 -mx-4 flex flex-col gap-2.5 border-b border-border/70 bg-background px-4 py-2.5 md:mx-0 md:rounded-xl md:border md:bg-card md:px-3 md:py-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.query}
              onChange={(e) => setFilter('query', e.target.value)}
              placeholder="Search member name..."
              aria-label="Search history"
              className="h-10 rounded-lg bg-background pl-9 pr-9"
            />
            {filters.query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setFilter('query', '')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto">
            <Select
              value={filters.status}
              onValueChange={(value) =>
                setFilter('status', value as HistoryStatusFilter)
              }
            >
              <SelectTrigger
                aria-label="Filter by status"
                className="h-10 w-full rounded-lg bg-background text-[0.8125rem] sm:w-[11rem]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="transferred-out">Transferred Out</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={String(filters.year)}
              onValueChange={(value) =>
                setFilter('year', value === 'all' ? 'all' : Number(value))
              }
            >
              <SelectTrigger
                aria-label="Filter by year"
                className="h-10 w-full rounded-lg bg-background text-[0.8125rem] sm:w-[9rem]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {years.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[0.6875rem] text-muted-foreground">
          <Badge
            variant="outline"
            className="border-border bg-card px-1.5 text-[0.6875rem] font-medium text-muted-foreground"
          >
            {historyMembers.length}
          </Badge>
          <span>
            {historyMembers.length === 1 ? 'member' : 'members'} in the archive
          </span>
        </div>
      </div>

      {body}

      <MemberHistoryDialog
        member={historyTarget}
        reference={
          historyTarget ? references.get(historyTarget.id) : undefined
        }
        canManage={canManage}
        onOpenChange={(open) => {
          if (!open) setHistoryTarget(null)
        }}
        onRequestRestore={() => historyTarget && requestRestore(historyTarget)}
      />

      {lifecycle && (
        <MemberLifecycleDialog
          open
          onOpenChange={(open) => {
            if (!open) setLifecycle(null)
          }}
          member={lifecycle.member}
          kind={lifecycle.kind}
        />
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete member?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete {deleteTarget?.firstName}{' '}
              {deleteTarget?.lastName}? This removes their entire record from
              the archive and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white"
              onClick={() => {
                if (!deleteTarget) return
                removeMember(deleteTarget.id)
                toast.success(
                  `${deleteTarget.firstName} ${deleteTarget.lastName} deleted.`,
                )
                setDeleteTarget(null)
                setHistoryTarget(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
