import { useMemo, useState, type DragEvent, type HTMLAttributes, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Eraser,
  GripVertical,
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
import { VoiceBadge } from '@/components/StatusBadges'
import { getVoiceName } from '@/core/constants/voicePositions'
import { REGULAR_WORSHIP_DUTY_ROLES } from '@/core/constants/dutyRoles'
import { useSuguanStore } from '@/store/suguanStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useAssignmentPresetStore } from '@/store/assignmentPresetStore'
import { buildMemberReferences, memberInitials } from '@/lib/memberDirectory'
import { cn } from '@/lib/utils'
import type { Member } from '@/core/types/member'
import type { SuguanAssignment, SuguanScheduleSection } from '@/core/types/suguan'
import { MemberSelector } from './MemberSelector'
import { DutyRolesPanel } from './DutyRolesPanel'
import { KoroMakerStep } from './KoroMakerStep'
import { groupGendersFor, type SuguanDraft } from './builderState'

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
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border/70 bg-card">
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
      <ScrollArea className={scrollClassName}>
        <div
          className={cn('flex flex-col gap-1.5 p-3', bodyClassName)}
          {...dropProps}
        >
          {body}
        </div>
      </ScrollArea>
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

function VoiceGroupHeader({
  label,
  count,
}: {
  label: string
  count: number
}) {
  return (
    <div className="flex items-center gap-2 px-0.5 pt-1">
      <h4 className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </h4>
      <span className="text-[0.625rem] tabular-nums text-muted-foreground/70">
        {count}
      </span>
      <span className="h-px flex-1 bg-border/70" />
    </div>
  )
}

export function AssignmentWorkspace({
  draft,
  patch,
  members,
  editingId,
}: AssignmentWorkspaceProps) {
  const allVoices = useSettingsStore((s) => s.allVoices)
  const voices = allVoices()
  const presets = useAssignmentPresetStore((s) => s.presets)
  const savePreset = useAssignmentPresetStore((s) => s.savePreset)
  const deletePreset = useAssignmentPresetStore((s) => s.deletePreset)
  const allSuguan = useSuguanStore((s) => s.suguan)

  const isSpecial = draft.type === 'special'

  const sections: SuguanScheduleSection[] = useMemo(() => {
    if (isSpecial) {
      return [
        {
          id: '__special__',
          scheduleLabel: draft.eventTitle.trim() || 'SPECIAL OCCASION',
          scheduleDay: '',
          scheduleTime: '',
          assignments: draft.assignments,
        },
      ]
    }
    return draft.schedules
  }, [draft.schedules, draft.assignments, draft.eventTitle, isSpecial])

  const [activeId, setActiveId] = useState<string>('')
  const section = sections.find((s) => s.id === activeId) ?? sections[0] ?? null

  const [query, setQuery] = useState('')
  const [voiceFilter, setVoiceFilter] = useState('all')
  const [presetId, setPresetId] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [replaceTarget, setReplaceTarget] = useState<SuguanAssignment | null>(null)
  const [koroMode, setKoroMode] = useState(false)
  const [drag, setDrag] = useState<DragPayload | null>(null)
  // Default alphabetical, per the previous request. Manual mode hands ordering
  // back to the officer via drag and the move up/down controls.
  const [orderMode, setOrderMode] = useState<'alpha' | 'manual'>('alpha')

  const setAssignments = (next: SuguanAssignment[]) => {
    if (isSpecial) {
      patch({ assignments: next })
      return
    }
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
  const activeScheduleLabel = section?.scheduleLabel ?? 'No schedule selected'

  if (isSpecial && koroMode) {
    return (
      <div className="flex flex-col gap-4">
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => setKoroMode(false)}
        >
          <ArrowLeft className="size-4" />
          Back to roster
        </Button>
        <KoroMakerStep draft={draft} patch={patch} members={members} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Active schedule header */}
      <header className="flex flex-col gap-3 rounded-lg bg-brand-navy px-4 py-3.5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-inset ring-white/15">
            <UserRoundCheck className="size-4.5 text-brand-teal-bright" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-tight">
              Assignments
            </h2>
            <p className="truncate text-xs text-white/65">
              Assign members to each schedule and set duty roles.
            </p>
          </div>
        </div>

        {isSpecial ? (
          <div className="flex items-center gap-2">
            <span className="truncate rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset ring-white/15">
              {activeScheduleLabel} · {assignments.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
              onClick={() => setKoroMode(true)}
            >
              Koro Maker
            </Button>
          </div>
        ) : sections.length === 0 ? (
          <p className="rounded-md bg-white/10 px-2.5 py-1.5 text-xs text-white/70 ring-1 ring-inset ring-white/15">
            No schedules yet — add one in the Schedules step.
          </p>
        ) : (
          <Tabs
            value={section?.id ?? ''}
            onValueChange={setActiveId}
            className="min-w-0 sm:max-w-[60%]"
          >
            <TabsList className="h-auto w-full justify-start gap-1.5 overflow-x-auto rounded-lg bg-white/5 p-1">
              {sections.map((s) => (
                <TabsTrigger
                  key={s.id}
                  value={s.id}
                  className="gap-2 whitespace-nowrap text-white/70 ring-1 ring-inset ring-transparent hover:text-white data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-brand-navy data-[state=active]:ring-white/20"
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
      </header>

      {/* Preset toolbar */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-lg border border-border/70 bg-card px-3 py-2.5">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Load preset
        </span>
        <Select
          value={presetId}
          onValueChange={loadPreset}
          disabled={presets.length === 0}
        >
          <SelectTrigger size="sm" className="w-56 bg-background">
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
            title="Delete preset"
            onClick={() => {
              deletePreset(presetId)
              setPresetId('')
            }}
          >
            <X className="size-4" />
          </Button>
        )}

        {!isSpecial && draft.schedules.length > 1 && (
          <Select onValueChange={copyFromSection} value="">
            <SelectTrigger size="sm" className="w-52 bg-background">
              <SelectValue placeholder="Copy from schedule…" />
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
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSaveOpen(true)}>
            <Save className="size-4" />
            Save as preset
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
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

      {/* Three-column workspace */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,30fr)_minmax(0,38fr)_minmax(0,32fr)]">
        <PanelShell
          icon={<Users className="size-4" />}
          title="Available Members"
          count={available.length}
          scrollClassName="h-[460px]"
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
              <Select value={voiceFilter} onValueChange={setVoiceFilter}>
                <SelectTrigger size="sm" className="w-full bg-background">
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
          }
          body={
            <>
              {available.length === 0 && (
                <EmptyState>No members available for this schedule.</EmptyState>
              )}
              {available.map((m) => (
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
                  className="group flex cursor-grab items-center gap-2.5 rounded-lg border border-border/60 bg-background px-2.5 py-2 transition-colors hover:border-brand-teal/40 hover:bg-brand-teal-soft/40 active:cursor-grabbing"
                >
                  <GripVertical className="size-3.5 shrink-0 text-muted-foreground/40" />
                  <MemberAvatar member={m} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {m.firstName} {m.lastName}
                    </span>
                    <span className="block truncate font-mono text-[0.625rem] tracking-tight text-muted-foreground">
                      {memberRefs.get(m.id) ?? '—'}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {doubleBooked.has(m.id) && (
                      <AlertTriangle
                        className="size-3.5 text-amber-500"
                        aria-label="Already assigned to another Suguan on this date"
                      />
                    )}
                    <VoiceBadge name={getVoiceName(m.voicePosition, voices)} />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-7 text-brand-navy/60 hover:bg-brand-teal-soft hover:text-brand-teal"
                      onClick={() => addMember(m)}
                      title="Add to roster"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </span>
                </div>
              ))}
            </>
          }
        />

        <PanelShell
          icon={<UsersRound className="size-4" />}
          title="Assigned"
          count={assignments.length}
          meta={isManual ? 'Drag to reorder' : 'Sorted A–Z'}
          scrollClassName="h-[460px]"
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
              {assignedByVoice.groups.map((group) =>
                group.items.length === 0 ? null : (
                  <div key={group.voice.id} className="flex flex-col gap-1.5">
                    <VoiceGroupHeader
                      label={group.voice.name}
                      count={group.items.length}
                    />
                    {group.items.map((a) => (
                      <AssignmentRow
                        key={`${a.memberId}-${a.voicePosition}`}
                        assignment={a}
                        member={memberById.get(a.memberId)}
                        reference={memberRefs.get(a.memberId)}
                        voices={voices}
                        conflicting={doubleBooked.has(a.memberId)}
                        reorderable={isManual}
                        first={indexOfAssignment(a) === 0}
                        last={
                          indexOfAssignment(a) ===
                          lastIndexInVoice(a.voicePosition)
                        }
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
                ),
              )}
              {assignedByVoice.orphans.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <VoiceGroupHeader
                    label="Other"
                    count={assignedByVoice.orphans.length}
                  />
                  {assignedByVoice.orphans.map((a) => (
                    <AssignmentRow
                      key={`${a.memberId}-${a.voicePosition}`}
                      assignment={a}
                      member={memberById.get(a.memberId)}
                      reference={memberRefs.get(a.memberId)}
                      voices={voices}
                      conflicting={doubleBooked.has(a.memberId)}
                      reorderable={isManual}
                      first={indexOfAssignment(a) === 0}
                      last={
                        indexOfAssignment(a) === lastIndexInVoice(a.voicePosition)
                      }
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
            </>
          }
        />

        <DutyRolesPanel
          dutyRoles={draft.dutyRoles}
          onDutyRolesChange={(dutyRoles) => patch({ dutyRoles })}
          destinadoName={draft.destinadoName}
          onDestinadoChange={(destinadoName) => patch({ destinadoName })}
          members={members}
          roleIds={REGULAR_WORSHIP_DUTY_ROLES}
        />
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
    </div>
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
        'group flex items-center gap-2 rounded-lg border border-border/60 bg-background px-2 py-1.5 transition-colors hover:border-brand-teal/40 hover:bg-brand-teal-soft/30',
        reorderable && 'cursor-grab active:cursor-grabbing',
      )}
    >
      <GripVertical
        className={cn(
          'size-3.5 shrink-0 transition-colors',
          reorderable
            ? 'text-muted-foreground/40 group-hover:text-muted-foreground'
            : 'text-muted-foreground/20',
        )}
      />
      <MemberAvatar member={member} name={assignment.memberName} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {assignment.memberName}
        </span>
        {reference && (
          <span className="block font-mono text-[0.625rem] tracking-tight text-muted-foreground">
            {reference}
          </span>
        )}
      </span>
      {conflicting && (
        <AlertTriangle
          className="size-3.5 shrink-0 text-amber-500"
          aria-label="Already assigned to another Suguan on this date"
        />
      )}
      <VoiceBadge name={getVoiceName(assignment.voicePosition, voices)} />
      <span className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {reorderable && (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-6"
              title="Move up"
              disabled={first}
              onClick={() => onMove(assignment, -1)}
            >
              <ArrowUp className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-6"
              title="Move down"
              disabled={last}
              onClick={() => onMove(assignment, 1)}
            >
              <ArrowDown className="size-3" />
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-6"
          title="Edit"
          onClick={() => onReplace(assignment)}
        >
          <Pencil className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-6 hover:text-destructive"
          title="Remove"
          onClick={() => onRemove(assignment)}
        >
          <Trash2 className="size-3" />
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
