import { useMemo, useState, type DragEvent, type HTMLAttributes, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  CalendarClock,
  ChevronDown,
  Eraser,
  GripVertical,
  MoreVertical,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  UserRoundCheck,
  Users,
  UsersRound,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { VoiceBadge } from '@/components/StatusBadges'
import { getVoiceName } from '@/core/constants/voicePositions'
import { useSuguanStore } from '@/store/suguanStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useAssignmentPresetStore } from '@/store/assignmentPresetStore'
import { buildMemberReferences, memberInitials } from '@/lib/memberDirectory'
import { cn } from '@/lib/utils'
import type { Member } from '@/core/types/member'
import type { SuguanAssignment, SuguanScheduleSection } from '@/core/types/suguan'
import { MemberSelector } from './MemberSelector'
import { DutyRolesPanel } from './DutyRolesPanel'
import { groupGendersFor, type SuguanDraft } from './builderState'
import { usePermissions } from '@/hooks/usePermissions'

interface AssignmentWorkspaceProps {
  draft: SuguanDraft
  patch: (p: Partial<SuguanDraft>) => void
  members: Member[]
  /** Id of the Suguan being edited, excluded from double-booking checks. */
  editingId?: string | null
}

type DragPayload =
  | { kind: 'available'; memberId: string }
  | { kind: 'assigned'; memberId: string; voicePosition: string }

const DRAG_TYPE = 'application/x-suguan-assignment'

/** Alphabetical by last name, then first name. */
function compareMembers(a: Member, b: Member): number {
  return (
    a.lastName.localeCompare(b.lastName, undefined, { sensitivity: 'base' }) ||
    a.firstName.localeCompare(b.firstName, undefined, { sensitivity: 'base' })
  )
}

/** Alphabetical using the live member record, falling back to the stored name. */
function assignmentSortKey(
  a: SuguanAssignment,
  memberNames: Map<string, string>,
): string {
  const live = memberNames.get(a.memberId)
  if (live) return live
  return a.memberName.split(' ').reverse().join(' ')
}

function PanelShell({
  icon,
  title,
  count,
  meta,
  headerExtra,
  toolbar,
  body,
  bodyClassName,
  scrollClassName,
  dropProps,
}: {
  icon: ReactNode
  title: string
  count?: number
  meta?: string
  headerExtra?: ReactNode
  toolbar?: ReactNode
  body: ReactNode
  bodyClassName?: string
  scrollClassName: string
  dropProps?: HTMLAttributes<HTMLDivElement>
}) {
  return (
    <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card xl:rounded-lg">
      <header className="flex items-center gap-2.5 border-b border-border/70 px-4 py-3">
        <span className="text-brand-navy/60">{icon}</span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {count !== undefined && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-muted-foreground">
            {count}
          </span>
        )}
        {meta && (
          <span className="truncate text-[11px] text-muted-foreground">
            {meta}
          </span>
        )}
        {headerExtra && (
          <span className="ml-auto flex shrink-0 items-center gap-1">
            {headerExtra}
          </span>
        )}
      </header>
      {toolbar && <div className="border-b border-border/70 p-3">{toolbar}</div>}
      {/* The drop target is the whole scroll viewport, not just the rows. The
          pointer can be anywhere over the container when content is short. */}
      <div className={cn('min-h-0 flex-1', scrollClassName)} {...dropProps}>
        <ScrollArea className="size-full">
          <div className={cn('flex flex-col gap-1.5 p-3', bodyClassName)}>
            {body}
          </div>
        </ScrollArea>
      </div>
    </section>
  )
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border px-4 py-8 text-center">
      <p className="text-sm font-medium text-muted-foreground">{children}</p>
    </div>
  )
}

export function AssignmentWorkspace({
  draft,
  patch,
  members,
  editingId,
}: AssignmentWorkspaceProps) {
  const { can } = usePermissions()
  const canAssignMembers = can('assign-members')
  const allVoices = useSettingsStore((s) => s.allVoices)
  const voices = allVoices()
  const presets = useAssignmentPresetStore((s) => s.presets)
  const savePreset = useAssignmentPresetStore((s) => s.savePreset)
  const deletePreset = useAssignmentPresetStore((s) => s.deletePreset)
  const allSuguan = useSuguanStore((s) => s.suguan)

  const sections: SuguanScheduleSection[] = draft.schedules

  const [activeId, setActiveId] = useState<string>('')
  const section = sections.find((s) => s.id === activeId) ?? sections[0] ?? null

  const [query, setQuery] = useState('')
  const [voiceFilter, setVoiceFilter] = useState('all')
  const [presetId, setPresetId] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [replaceTarget, setReplaceTarget] = useState<SuguanAssignment | null>(null)
  const [drag, setDrag] = useState<DragPayload | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [openVoices, setOpenVoices] = useState<Record<string, boolean>>({})
  // Default alphabetical, per the previous request. Manual mode hands ordering
  // back to the officer via drag and the move up/down controls.
  const [orderMode, setOrderMode] = useState<'alpha' | 'manual'>('alpha')
  /** Mobile only: the special duties panel starts collapsed under its dropdown. */
  const [dutiesOpen, setDutiesOpen] = useState(false)

  const setAssignments = (next: SuguanAssignment[]) => {
    const schedules = draft.schedules.map((s) =>
      s.id === section?.id ? { ...s, assignments: next } : s,
    )
    patch({
      schedules,
      assignments: schedules.flatMap((s) => s.assignments),
    })
  }

  const groupGenders = groupGendersFor(draft.group)
  const choirVoices = useMemo(
    () => voices.filter((v) => groupGenders.includes(v.gender)),
    [voices, groupGenders],
  )
  const assignments = useMemo<SuguanAssignment[]>(
    () => section?.assignments ?? [],
    [section],
  )
  const assignedIds = useMemo(
    () => new Set(assignments.map((a) => a.memberId)),
    [assignments],
  )

  const memberRefs = useMemo(() => buildMemberReferences(members), [members])
  const memberById = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  )

  const doubleBooked = useMemo(() => {
    const ids = new Set<string>()
    const millis = new Date(`${draft.date}T${draft.time || '00:00'}`).getTime()
    for (const s of allSuguan) {
      // Skip the Suguan being edited so its own roster is not treated as a clash.
      if (editingId && s.id === editingId) continue
      if (new Date(`${s.date}T${s.time || '00:00'}`).getTime() !== millis) continue
      for (const a of s.assignments) ids.add(a.memberId)
    }
    return ids
  }, [allSuguan, draft.date, draft.time, editingId])

  const available = useMemo(() => {
    const q = query.trim().toLowerCase()
    return members
      .filter((m) => m.isActive)
      .filter((m) => groupGenders.includes(m.gender))
      .filter((m) => !assignedIds.has(m.id))
      .filter((m) => voiceFilter === 'all' || m.voicePosition === voiceFilter)
      .filter((m) =>
        q
          ? `${m.firstName} ${m.lastName} ${getVoiceName(m.voicePosition, voices)}`
              .toLowerCase()
              .includes(q)
          : true,
      )
      .sort(compareMembers)
  }, [members, groupGenders, assignedIds, voiceFilter, query, voices])

  const assignedByVoice = useMemo(() => {
    const memberNames = new Map(
      members.map((m) => [m.id, `${m.lastName} ${m.firstName}`]),
    )
    const byName = (a: SuguanAssignment, b: SuguanAssignment) =>
      assignmentSortKey(a, memberNames).localeCompare(
        assignmentSortKey(b, memberNames),
        undefined,
        { sensitivity: 'base' },
      )
    const order = orderMode === 'alpha' ? byName : () => 0
    const groups = choirVoices.map((v) => ({
      voice: v,
      items: assignments.filter((a) => a.voicePosition === v.id).sort(order),
    }))
    const orphans = assignments
      .filter((a) => !choirVoices.some((v) => v.id === a.voicePosition))
      .sort(order)
    return { groups, orphans }
  }, [assignments, choirVoices, members, orderMode])

  const addMember = (member: Member) => {
    setAssignments([
      ...assignments,
      {
        memberId: member.id,
        memberName: `${member.firstName} ${member.lastName}`,
        voicePosition: member.voicePosition,
        assignedAt: new Date().toISOString(),
      },
    ])
  }

  const removeMember = (target: SuguanAssignment) => {
    setAssignments(
      assignments.filter(
        (a) => !(a.memberId === target.memberId && a.voicePosition === target.voicePosition),
      ),
    )
  }

  const moveMember = (target: SuguanAssignment, dir: -1 | 1) => {
    const idx = assignments.findIndex(
      (a) => a.memberId === target.memberId && a.voicePosition === target.voicePosition,
    )
    if (idx < 0) return
    let swap = -1
    for (let j = idx + dir; j >= 0 && j < assignments.length; j += dir) {
      if (assignments[j].voicePosition === target.voicePosition) {
        swap = j
        break
      }
    }
    if (swap < 0) return
    const list = [...assignments]
    ;[list[idx], list[swap]] = [list[swap], list[idx]]
    setAssignments(list)
  }

  const indexOfAssignment = (a: SuguanAssignment) =>
    assignments.findIndex(
      (x) => x.memberId === a.memberId && x.voicePosition === a.voicePosition,
    )

  const lastIndexInVoice = (voicePosition: string) => {
    for (let j = assignments.length - 1; j >= 0; j--) {
      if (assignments[j].voicePosition === voicePosition) return j
    }
    return -1
  }

  const handleDrop = (e: DragEvent, target?: SuguanAssignment) => {
    e.preventDefault()
    e.stopPropagation()
    const payload = drag ?? readDragPayload(e)
    setDrag(null)
    if (!payload) return
    const list = [...assignments]

    if (payload.kind === 'available') {
      const member = members.find((m) => m.id === payload.memberId)
      if (!member) return
      // In manual mode a drop on a row inserts right after that row, but only
      // when the row belongs to the same voice group. Otherwise append.
      let at = list.length
      if (isManual && target && target.voicePosition === member.voicePosition) {
        at = indexOfAssignment(target) + 1
      }
      list.splice(Math.max(0, Math.min(at, list.length)), 0, {
        memberId: member.id,
        memberName: `${member.firstName} ${member.lastName}`,
        voicePosition: member.voicePosition,
        assignedAt: new Date().toISOString(),
      })
      setAssignments(list)
      return
    }

    const from = list.findIndex(
      (a) =>
        a.memberId === payload.memberId && a.voicePosition === payload.voicePosition,
    )
    if (from < 0) return
    const [item] = list.splice(from, 1)
    // Reordering is only meaningful inside a single voice group.
    if (isManual && target && target.voicePosition === item.voicePosition) {
      const at = indexOfAssignment(target)
      list.splice(from < at ? at + 1 : at, 0, item)
    } else {
      list.splice(from, 0, item)
    }
    setAssignments(list)
  }

  const selectSection = (id: string) => {
    setActiveId(id)
    // A preset is only meaningful for the schedule it was loaded into, so
    // switching schedules must clear the choice, letting the same preset be
    // picked again for the next schedule.
    setPresetId('')
  }

  const loadPreset = (id: string) => {
    const preset = presets.find((p) => p.id === id)
    if (!preset || !section) return
    const now = new Date().toISOString()
    setAssignments(
      preset.assignments.map((a) => ({
        memberId: a.memberId,
        memberName: a.memberName,
        voicePosition: a.voicePosition,
        assignedAt: now,
      })),
    )
    setPresetId(id)
    toast.success(`Preset "${preset.name}" loaded into ${section.scheduleLabel}.`)
  }

  const copyFromSection = (id: string) => {
    const source = draft.schedules.find((s) => s.id === id)
    if (!source || !section) return
    setAssignments(source.assignments.map((a) => ({ ...a })))
    toast.success(`Copied ${source.assignments.length} members from ${source.scheduleLabel}.`)
  }

  const handleSavePreset = () => {
    const name = presetName.trim()
    if (!name) {
      toast.error('Give the preset a name first.')
      return
    }
    if (assignments.length === 0) {
      toast.error('Add at least one member before saving a preset.')
      return
    }
    savePreset(name, assignments, draft.dutyRoles)
    setSaveOpen(false)
    setPresetName('')
    toast.success(`Assignment preset "${name}" saved.`)
  }

  const replaceCandidates = useMemo(() => {
    if (!replaceTarget) return []
    return members
      .filter((m) => m.isActive)
      .filter((m) => groupGenders.includes(m.gender))
      .filter((m) => m.gender === (voices.find((v) => v.id === replaceTarget.voicePosition)?.gender ?? m.gender))
      .filter(
        (m) =>
          m.id === replaceTarget.memberId ||
          !assignments.some((a) => a.memberId === m.id),
      )
  }, [replaceTarget, members, groupGenders, voices, assignments])

  const isManual = orderMode === 'manual'

  const isVoiceOpen = (key: string) => openVoices[key] ?? true
  const toggleVoice = (key: string) =>
    setOpenVoices((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }))

  /** The Add Members sheet always opens with a fresh voice filter and query. */
  const openAddMembers = () => {
    setVoiceFilter('all')
    setQuery('')
    setAddOpen(true)
  }

  const renderPresetCard = (className?: string) => (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3.5 shadow-[0_1px_2px_rgba(16,42,67,0.04)] xl:rounded-lg',
        className,
      )}
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Load preset
          </span>
          <div className="flex items-center gap-2">
            <Select
              value={presetId}
              onValueChange={loadPreset}
              disabled={presets.length === 0}
            >
              <SelectTrigger size="sm" className="h-9 flex-1 bg-background">
                <SelectValue
                  placeholder={
                    presets.length === 0
                      ? 'No presets saved yet'
                      : 'Choose a preset group'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {presets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.assignments.length} members)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {presetId && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                title="Delete preset"
                onClick={() => {
                  deletePreset(presetId)
                  setPresetId('')
                }}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {draft.schedules.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Copy from schedule
            </span>
            <Select onValueChange={copyFromSection} value="">
              <SelectTrigger size="sm" className="h-9 w-full bg-background">
                <SelectValue placeholder="Choose schedule…" />
              </SelectTrigger>
              <SelectContent>
                {draft.schedules
                  .filter((s) => s.id !== section?.id)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.scheduleLabel} ({s.assignments.length})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border/60 pt-2.5">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 sm:flex-none"
          onClick={() => setSaveOpen(true)}
        >
          <Save className="size-4" />
          Save as preset
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 text-muted-foreground hover:text-destructive sm:flex-none"
          onClick={() => {
            setAssignments([])
            setPresetId('')
            toast.info('Roster cleared for this schedule.')
          }}
          disabled={assignments.length === 0}
        >
          <Eraser className="size-4" />
          Clear
        </Button>
      </div>
    </div>
  )

  const visibleVoiceGroups = assignedByVoice.groups.filter(
    (g) => g.items.length > 0,
  )

  const renderMobileGroup = (
    key: string,
    label: string,
    items: SuguanAssignment[],
  ) => {
    const open = isVoiceOpen(key)
    return (
      <div
        key={key}
        className="overflow-hidden rounded-xl border border-border/60 bg-background"
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={() => toggleVoice(key)}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        >
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
          <span className="truncate text-sm font-semibold text-foreground">
            {label}
          </span>
          <span className="rounded-full bg-brand-navy-soft px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums text-brand-navy">
            {items.length}
          </span>
        </button>
        {open && (
          <div className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto px-2.5 pb-2.5">
            {items.map((a) => {
              const member = memberById.get(a.memberId)
              const idx = indexOfAssignment(a)
              return (
                <div
                  key={`${a.memberId}-${a.voicePosition}`}
                  className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3 py-2.5"
                >
                  <MemberAvatar
                    member={member}
                    name={a.memberName}
                    className="size-9"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {a.memberName}
                    </p>
                    <p className="truncate font-mono text-[0.625rem] tracking-tight text-muted-foreground">
                      {memberRefs.get(a.memberId) ?? '—'}
                    </p>
                  </div>
                  {doubleBooked.has(a.memberId) && (
                    <AlertTriangle
                      className="size-3.5 shrink-0 text-amber-500"
                      aria-label="Already assigned to another Suguan on this date"
                    />
                  )}
                  <VoiceBadge name={getVoiceName(a.voicePosition, voices)} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-8 shrink-0 text-muted-foreground"
                        aria-label={`Actions for ${a.memberName}`}
                      >
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={!isManual || idx === 0}
                        onSelect={() => moveMember(a, -1)}
                      >
                        <ArrowUp className="size-4" />
                        Move up
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={
                          !isManual || idx === lastIndexInVoice(a.voicePosition)
                        }
                        onSelect={() => moveMember(a, 1)}
                      >
                        <ArrowDown className="size-4" />
                        Move down
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setReplaceTarget(a)}>
                        <Pencil className="size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => removeMember(a)}
                      >
                        <Trash2 className="size-4" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const renderDesktopGroup = (
    key: string,
    label: string,
    items: SuguanAssignment[],
  ) => {
    const open = isVoiceOpen(key)
    return (
      <div
        key={key}
        className="overflow-hidden rounded-lg border border-border/60 bg-background"
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={() => toggleVoice(key)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left"
        >
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
          <span className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-foreground">
            {label}
          </span>
          <span className="rounded-full bg-brand-navy-soft px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums text-brand-navy">
            {items.length}
          </span>
        </button>
        {open && (
          <div className="flex flex-col gap-1.5 border-t border-border/60 p-1.5">
            {items.map((a) => (
              <AssignmentRow
                key={`${a.memberId}-${a.voicePosition}`}
                assignment={a}
                member={memberById.get(a.memberId)}
                reference={memberRefs.get(a.memberId)}
                voices={voices}
                conflicting={doubleBooked.has(a.memberId)}
                reorderable={isManual}
                first={indexOfAssignment(a) === 0}
                last={indexOfAssignment(a) === lastIndexInVoice(a.voicePosition)}
                onDragStart={() =>
                  setDrag({
                    kind: 'assigned',
                    memberId: a.memberId,
                    voicePosition: a.voicePosition,
                  })
                }
                onDragEnd={() => setDrag(null)}
                onDrop={(e) => handleDrop(e, a)}
                onMove={moveMember}
                onRemove={removeMember}
                onReplace={setReplaceTarget}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (!canAssignMembers) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
        <p className="font-medium">Assignment editing is restricted</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This role can work with Suguan details but does not have permission to
          assign members or manage duty roles.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Mobile app layout */}
      <div className="flex flex-col gap-3 xl:hidden">
        {/* Header / schedule context */}
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-[0_1px_2px_rgba(16,42,67,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                Assignments
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Assign members and duty roles
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-brand-navy-soft px-2.5 py-1 text-xs font-semibold tabular-nums text-brand-navy">
              {assignments.length} assigned
            </span>
          </div>

          {sections.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-border px-3 py-2.5 text-center text-xs text-muted-foreground">
              No schedules yet — add one in the Schedules step.
            </p>
          ) : sections.length === 1 ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-brand-navy px-3.5 py-3 text-sm font-semibold uppercase tracking-wide text-white">
              <CalendarClock className="size-4 shrink-0 text-white/70" />
              <span className="truncate">{sections[0].scheduleLabel}</span>
            </div>
          ) : (
            <Select value={section?.id ?? ''} onValueChange={selectSection}>
              <SelectTrigger className="mt-3 h-12 w-full gap-2 border-0 bg-brand-navy px-3.5 text-sm font-semibold uppercase tracking-wide text-white shadow-none hover:bg-brand-navy/90 focus-visible:ring-2 focus-visible:ring-brand-navy/40 [&_svg]:text-white/70">
                <SelectValue placeholder="Choose schedule" />
              </SelectTrigger>
              <SelectContent>
              {sections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.scheduleLabel} ({s.assignments.length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {renderPresetCard(
          'mt-3 border-0 bg-transparent p-0 shadow-none xl:rounded-none',
        )}
      </div>

        {/* Voice balance chips */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
          {choirVoices.map((v) => {
            const count = assignments.filter(
              (a) => a.voicePosition === v.id,
            ).length
            return (
              <div
                key={v.id}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 shadow-[0_1px_2px_rgba(16,42,67,0.04)]"
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {v.name}
                </span>
                <span
                  className={cn(
                    'text-sm font-bold tabular-nums',
                    count > 0 ? 'text-brand-navy' : 'text-muted-foreground/50',
                  )}
                >
                  {count}
                </span>
              </div>
            )
          })}
        </div>

        {/* Assigned members — main area */}
        <div className="rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(16,42,67,0.04)]">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-foreground">
                Assigned Members
              </h3>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-muted-foreground">
                {assignments.length}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-muted p-0.5">
              <button
                type="button"
                onClick={() => setOrderMode('alpha')}
                className={cn(
                  'rounded-md px-2 py-0.5 text-[0.6875rem] font-medium transition-colors',
                  !isManual
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                A–Z
              </button>
              <button
                type="button"
                onClick={() => setOrderMode('manual')}
                className={cn(
                  'rounded-md px-2 py-0.5 text-[0.6875rem] font-medium transition-colors',
                  isManual
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Manual
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 p-3">
            {assignments.length === 0 && (
              <EmptyState>
                No members assigned yet. Tap Add Members to start.
              </EmptyState>
            )}

            {visibleVoiceGroups.map((g) =>
              renderMobileGroup(g.voice.id, g.voice.name, g.items),
            )}
            {assignedByVoice.orphans.length > 0 &&
              renderMobileGroup(
                'orphans',
                'Other',
                assignedByVoice.orphans,
              )}

            <Button
              className="mt-1 h-12 w-full rounded-xl shadow-[0_4px_14px_rgba(37,99,235,0.3)]"
              onClick={openAddMembers}
            >
              <Plus className="size-4.5" />
              Add Members
            </Button>
          </div>
        </div>

        {/* Special duties — collapsed behind a dropdown so the roster stays on screen */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setDutiesOpen((o) => !o)}
            aria-expanded={dutiesOpen}
            className="flex w-full items-center gap-2.5 rounded-2xl border border-border/70 bg-card px-4 py-3 text-left shadow-[0_1px_2px_rgba(16,42,67,0.04)] transition-colors hover:bg-accent/50"
          >
            <BadgeCheck className="size-4 shrink-0 text-brand-navy/70" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                Special duties
              </span>
              <span className="block text-xs text-muted-foreground">
                Officers and special roles
              </span>
            </span>
            {draft.dutyRoles.length > 0 && (
              <span className="rounded-full bg-brand-navy-soft px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums text-brand-navy">
                {draft.dutyRoles.length}
              </span>
            )}
            <ChevronDown
              className={cn(
                'size-4 shrink-0 text-muted-foreground transition-transform',
                dutiesOpen && 'rotate-180',
              )}
            />
          </button>

          {dutiesOpen && (
            <DutyRolesPanel
              hideHeader
              scrollClassName="h-auto"
              dutyRoles={draft.dutyRoles}
              onDutyRolesChange={(dutyRoles) => patch({ dutyRoles })}
              destinadoName={draft.destinadoName}
              onDestinadoChange={(destinadoName) => patch({ destinadoName })}
              members={members}
            />
          )}
        </div>
      </div>

      {/* Desktop layout — center column of the builder's three-column step */}
      <div className="hidden flex-col gap-4 xl:flex">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border/70 bg-card">
          <header className="flex items-center gap-2.5 border-b border-border/70 px-4 py-3">
            <span className="text-brand-navy/60">
              <UserRoundCheck className="size-4" />
            </span>
            <h3 className="text-sm font-semibold text-foreground">
              Assign Members
            </h3>
            <span className="rounded-full bg-brand-navy-soft px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-brand-navy">
              {assignments.length} assigned
            </span>
            <span className="ml-auto truncate text-[11px] text-muted-foreground">
              {section
                ? [section.scheduleDay, section.scheduleTime]
                    .filter(Boolean)
                    .join(' · ')
                : ''}
            </span>
          </header>

          {sections.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">
              No schedules yet — add one in the Schedules panel.
            </p>
          ) : (
            <Tabs
              value={section?.id ?? ''}
              onValueChange={selectSection}
              className="min-w-0 px-3 py-2.5"
            >
              <TabsList className="h-auto w-full justify-start gap-1.5 overflow-x-auto rounded-lg bg-muted p-1">
                {sections.map((s) => (
                  <TabsTrigger
                    key={s.id}
                    value={s.id}
                    className="gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground data-[state=active]:bg-brand-navy data-[state=active]:text-white"
                  >
                    {s.scheduleLabel}
                    <span className="rounded-full bg-current/15 px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums">
                      {s.assignments.length}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          {renderPresetCard(
            'rounded-none border-x-0 border-b-0 border-t border-border/60 bg-transparent shadow-none',
          )}
        </section>

      {/* Available | Assigned | Special duties */}
      <div className="grid min-w-0 grid-cols-3 items-stretch gap-4">
      <div className="h-[560px] min-h-0">
      <PanelShell
        icon={<Users className="size-4" />}
        title="Available Members"
        count={available.length}
        scrollClassName="h-full"
        toolbar={
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search members…"
                className="h-9 bg-background pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[{ id: 'all', name: 'All' }, ...choirVoices].map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVoiceFilter(v.id)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors',
                    voiceFilter === v.id
                      ? 'border-transparent bg-brand-navy text-white'
                      : 'border-border/60 bg-background text-muted-foreground hover:text-foreground',
                  )}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>
        }
        body={
          sections.length === 0 ? (
            <EmptyState>Add a schedule first to assign members.</EmptyState>
          ) : available.length === 0 ? (
            <EmptyState>No members available for this schedule.</EmptyState>
          ) : (
            available.map((m) => (
                <div
                  key={m.id}
                  draggable
                  onDragStart={(e) => {
                    const payload: DragPayload = { kind: 'available', memberId: m.id }
                    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload))
                    e.dataTransfer.effectAllowed = 'copy'
                    setDrag(payload)
                  }}
                  onDragEnd={() => setDrag(null)}
                  onDoubleClick={() => addMember(m)}
                  className="group flex cursor-grab items-center gap-2.5 rounded-2xl border border-border/60 bg-card px-3 py-2.5 shadow-[0_1px_2px_rgba(16,42,67,0.04)] transition-colors hover:border-brand-teal/40 hover:bg-brand-teal-soft/40 active:cursor-grabbing xl:gap-2.5 xl:rounded-lg xl:bg-background xl:px-2.5 xl:py-2 xl:shadow-none"
                >
                  <GripVertical className="hidden size-3.5 shrink-0 text-muted-foreground/40 xl:block" />
                  <MemberAvatar member={m} className="size-9 xl:size-7" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {m.firstName} {m.lastName}
                    </span>
                    <span className="block truncate font-mono text-[0.625rem] tracking-tight text-muted-foreground">
                      {memberRefs.get(m.id) ?? '—'}
                    </span>
                    <span className="mt-1.5 flex items-center gap-1.5 xl:hidden">
                      {doubleBooked.has(m.id) && (
                        <AlertTriangle
                          className="size-3.5 text-amber-500"
                          aria-label="Already assigned to another Suguan on this date"
                        />
                      )}
                      <VoiceBadge name={getVoiceName(m.voicePosition, voices)} />
                    </span>
                  </span>
                  <span className="hidden shrink-0 items-center gap-1.5 xl:flex">
                    {doubleBooked.has(m.id) && (
                      <AlertTriangle
                        className="size-3.5 text-amber-500"
                        aria-label="Already assigned to another Suguan on this date"
                      />
                    )}
                    <VoiceBadge name={getVoiceName(m.voicePosition, voices)} />
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-8 shrink-0 rounded-full border border-border/60 text-brand-navy/70 hover:border-brand-teal hover:bg-brand-teal-soft hover:text-brand-teal xl:size-7 xl:border-0"
                    onClick={() => addMember(m)}
                    title="Add to roster"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
            ))
          )
        }
      />
      </div>

      <div className="h-[560px] min-h-0">
      <PanelShell
        icon={<UsersRound className="size-4" />}
        title="Assigned"
        count={assignments.length}
        meta={isManual ? 'Drag to reorder' : 'Sorted A–Z'}
        scrollClassName="h-full"
        headerExtra={
            <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
              <button
                type="button"
                onClick={() => setOrderMode('alpha')}
                className={cn(
                  'rounded-md px-2 py-0.5 text-[0.6875rem] font-medium transition-colors',
                  !isManual
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                A–Z
              </button>
              <button
                type="button"
                onClick={() => setOrderMode('manual')}
                className={cn(
                  'rounded-md px-2 py-0.5 text-[0.6875rem] font-medium transition-colors',
                  isManual
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Manual
              </button>
            </div>
          }
          dropProps={{
            onDragOver: (e: DragEvent) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = isManual ? 'move' : 'copy'
            },
            onDrop: (e: DragEvent) => handleDrop(e),
          }}
        body={
          <>
            {assignments.length === 0 && (
              <EmptyState>
                No members assigned yet. Add members from the Available Members
                panel.
              </EmptyState>
            )}
            {visibleVoiceGroups.map((g) =>
              renderDesktopGroup(g.voice.id, g.voice.name, g.items),
            )}
            {assignedByVoice.orphans.length > 0 &&
              renderDesktopGroup(
                'orphans',
                'Other',
                assignedByVoice.orphans,
              )}
          </>
        }
      />
      </div>

      <div className="h-[560px] min-h-0">
      <DutyRolesPanel
        dutyRoles={draft.dutyRoles}
        onDutyRolesChange={(dutyRoles) => patch({ dutyRoles })}
        destinadoName={draft.destinadoName}
        onDestinadoChange={(destinadoName) => patch({ destinadoName })}
        members={members}
        scrollClassName="h-full flex-1 min-h-0"
      />
      </div>
      </div>
    </div>

      <Dialog
        open={!!replaceTarget}
        onOpenChange={(o) => !o && setReplaceTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Replace member</DialogTitle>
          </DialogHeader>
          {replaceTarget && (
            <MemberSelector
              candidates={replaceCandidates}
              excludedIds={[]}
              conflictIds={new Set()}
              singleSelect
              onSelect={(picked) => {
                const member = picked[0]
                if (member) {
                  setAssignments(
                    assignments.map((a) =>
                      a.memberId === replaceTarget.memberId &&
                      a.voicePosition === replaceTarget.voicePosition
                        ? {
                            ...a,
                            memberId: member.id,
                            memberName: `${member.firstName} ${member.lastName}`,
                            voicePosition: member.voicePosition,
                          }
                        : a,
                    ),
                  )
                }
                setReplaceTarget(null)
              }}
              onClose={() => setReplaceTarget(null)}
              addLabel="Replace"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save assignment preset</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="preset-name">Preset name</Label>
              <Input
                id="preset-name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="e.g. Sunday 10:00 AM Group"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSavePreset()
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {assignments.length} members and {draft.dutyRoles.length} duty roles
              will be stored.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePreset}>
              <Save className="size-4" />
              Save preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add members — mobile bottom sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[85vh] gap-0 rounded-t-3xl border-border/70 bg-background p-0"
        >
          <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border" />
          <SheetHeader className="gap-1 border-b border-border/70 px-4 pb-3 pt-2">
            <SheetTitle className="text-base font-semibold text-foreground">
              Add members
            </SheetTitle>
            <SheetDescription className="text-xs">
              Search the roster, then tap + to add a member.
            </SheetDescription>
          </SheetHeader>

          <div className="flex shrink-0 flex-col gap-2 px-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search members…"
                className="h-10 bg-card pl-9"
              />
            </div>
            <Select value={voiceFilter} onValueChange={setVoiceFilter}>
              <SelectTrigger size="sm" className="h-10 w-full bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All voices</SelectItem>
                {choirVoices.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            <div className="flex flex-col gap-2">
              {available.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No members match.
                </p>
              )}
              {available.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5"
                >
                  <MemberAvatar member={m} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {m.firstName} {m.lastName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {getVoiceName(m.voicePosition, voices)}
                    </p>
                  </div>
                  {doubleBooked.has(m.id) && (
                    <AlertTriangle
                      className="size-4 shrink-0 text-amber-500"
                      aria-label="Already assigned to another Suguan on this date"
                    />
                  )}
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="size-9 shrink-0 rounded-full border-brand-navy/30 text-brand-navy hover:border-brand-teal hover:bg-brand-teal-soft hover:text-brand-teal"
                    onClick={() => addMember(m)}
                    aria-label={`Add ${m.firstName} ${m.lastName}`}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function MemberAvatar({
  member,
  name,
  className,
}: {
  member?: Member
  name?: string
  className?: string
}) {
  const initials = member
    ? memberInitials(member, 'first-name')
    : (name ?? '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p.charAt(0))
        .join('')
        .toUpperCase()

  return (
    <span
      aria-hidden
      className={cn(
        'flex size-7 shrink-0 select-none items-center justify-center rounded-full bg-brand-navy-soft text-[0.625rem] font-semibold tracking-tight text-brand-navy ring-1 ring-inset ring-brand-navy/10',
        className,
      )}
    >
      {initials || '—'}
    </span>
  )
}

function AssignmentRow({
  assignment,
  member,
  reference,
  voices,
  conflicting,
  reorderable,
  first,
  last,
  onDragStart,
  onDragEnd,
  onDrop,
  onMove,
  onRemove,
  onReplace,
}: {
  assignment: SuguanAssignment
  member?: Member
  reference?: string
  voices: { id: string; name: string; shortName: string; gender: 'male' | 'female' }[]
  conflicting: boolean
  reorderable: boolean
  first: boolean
  last: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDrop: (e: DragEvent) => void
  onMove: (a: SuguanAssignment, dir: -1 | 1) => void
  onRemove: (a: SuguanAssignment) => void
  onReplace: (a: SuguanAssignment) => void
}) {
  return (
    <div
      draggable={reorderable}
      onDragStart={(e) => {
        const payload: DragPayload = {
          kind: 'assigned',
          memberId: assignment.memberId,
          voicePosition: assignment.voicePosition,
        }
        e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload))
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = reorderable ? 'move' : 'copy'
      }}
      onDrop={onDrop}
      className={cn(
        'group flex items-center gap-2.5 rounded-2xl border border-border/60 bg-card px-3 py-2.5 shadow-[0_1px_2px_rgba(16,42,67,0.04)] transition-colors hover:border-brand-teal/40 hover:bg-brand-teal-soft/30 xl:gap-2 xl:rounded-lg xl:bg-background xl:px-2 xl:py-1.5 xl:shadow-none',
        reorderable && 'cursor-grab active:cursor-grabbing',
      )}
    >
      <GripVertical
        className={cn(
          'hidden size-3.5 shrink-0 transition-colors xl:block',
          reorderable
            ? 'text-muted-foreground/40 group-hover:text-muted-foreground'
            : 'text-muted-foreground/20',
        )}
      />
      <MemberAvatar
        member={member}
        name={assignment.memberName}
        className="size-9 xl:size-7"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {assignment.memberName}
        </span>
        {reference && (
          <span className="block font-mono text-[0.625rem] tracking-tight text-muted-foreground">
            {reference}
          </span>
        )}
        <span className="mt-1.5 flex items-center gap-1.5 xl:hidden">
          {conflicting && (
            <AlertTriangle
              className="size-3.5 shrink-0 text-amber-500"
              aria-label="Already assigned to another Suguan on this date"
            />
          )}
          <VoiceBadge name={getVoiceName(assignment.voicePosition, voices)} />
        </span>
      </span>
      <span className="hidden shrink-0 items-center gap-1.5 xl:flex">
        {conflicting && (
          <AlertTriangle
            className="size-3.5 shrink-0 text-amber-500"
            aria-label="Already assigned to another Suguan on this date"
          />
        )}
        <VoiceBadge name={getVoiceName(assignment.voicePosition, voices)} />
      </span>
      <span className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity focus-within:opacity-100 xl:opacity-0 xl:group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 xl:size-6"
          title="Move up"
          disabled={!reorderable || first}
          onClick={() => onMove(assignment, -1)}
        >
          <ArrowUp className="size-3.5 xl:size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 xl:size-6"
          title="Move down"
          disabled={!reorderable || last}
          onClick={() => onMove(assignment, 1)}
        >
          <ArrowDown className="size-3.5 xl:size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 xl:size-6"
          title="Edit"
          onClick={() => onReplace(assignment)}
        >
          <Pencil className="size-3.5 xl:size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 xl:size-6 hover:text-destructive"
          title="Remove"
          onClick={() => onRemove(assignment)}
        >
          <Trash2 className="size-3.5 xl:size-3" />
        </Button>
      </span>
    </div>
  )
}

function readDragPayload(e: DragEvent): DragPayload | null {
  const raw = e.dataTransfer.getData(DRAG_TYPE)
  if (!raw) return null
  try {
    return JSON.parse(raw) as DragPayload
  } catch {
    return null
  }
}
