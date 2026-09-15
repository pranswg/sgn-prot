import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getVoiceName } from '@/core/constants/voicePositions'
import { REGULAR_WORSHIP_DUTY_ROLES } from '@/core/constants/dutyRoles'
import { useSuguanStore } from '@/store/suguanStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useAssignmentPresetStore } from '@/store/assignmentPresetStore'
import type { Member } from '@/core/types/member'
import type { SuguanAssignment } from '@/core/types/suguan'
import type { SuguanDraft } from './SuguanBuilderPage'
import { MemberSelector } from './MemberSelector'
import { DutyRolesPanel } from './DutyRolesPanel'

interface VoiceAssignmentsStepProps {
  draft: SuguanDraft
  patch: (p: Partial<SuguanDraft>) => void
  members: Member[]
  includeDutyRoles?: boolean
  assignments?: SuguanAssignment[]
  onAssignmentsChange?: (assignments: SuguanAssignment[]) => void
  sectionTitle?: string
  initialPresetId?: string
}

export function VoiceAssignmentsStep({
  draft,
  patch,
  members,
  includeDutyRoles = false,
  assignments: assignmentsProp,
  onAssignmentsChange,
  sectionTitle,
  initialPresetId,
}: VoiceAssignmentsStepProps) {
  const allSuguan = useSuguanStore((s) => s.suguan)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const voices = allVoices()
  const presets = useAssignmentPresetStore((s) => s.presets)
  const savePresetToStore = useAssignmentPresetStore((s) => s.savePreset)
  const deletePresetFromStore = useAssignmentPresetStore((s) => s.deletePreset)
  const [pickerVoice, setPickerVoice] = useState<string | null>(null)
  const [selectedPresetId, setSelectedPresetId] = useState(initialPresetId ?? '')
  const [presetDialogOpen, setPresetDialogOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [expandedVoices, setExpandedVoices] = useState<Set<string>>(new Set())

  const assignments = assignmentsProp ?? draft.assignments

  const fireAssignments = (next: SuguanAssignment[]) => {
    if (onAssignmentsChange) onAssignmentsChange(next)
    else patch({ assignments: next })
  }

  const toggleExpand = (voiceId: string) => {
    setExpandedVoices((prev) => {
      const next = new Set(prev)
      if (next.has(voiceId)) next.delete(voiceId)
      else next.add(voiceId)
      return next
    })
  }

  const MAX_VISIBLE_MEMBERS = 3

  const assignedIds = useMemo(
    () => new Set(assignments.map((a) => a.memberId)),
    [assignments],
  )

  const doubleBookedIds = useMemo(() => {
    const ids = new Set<string>()
    const thisMillis = new Date(`${draft.date}T${draft.time || '00:00'}`).getTime()
    for (const s of allSuguan) {
      if (s.id === undefined) continue
      const millis = new Date(`${s.date}T${s.time || '00:00'}`).getTime()
      if (millis === thisMillis) {
        for (const a of s.assignments) ids.add(a.memberId)
      }
    }
    return ids
  }, [allSuguan, draft.date, draft.time])

  const loadPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId)
    if (!preset) return
    const now = new Date().toISOString()
    fireAssignments(
      preset.assignments.map((a) => ({
        memberId: a.memberId,
        memberName: a.memberName,
        voicePosition: a.voicePosition,
        assignedAt: now,
      })),
    )
    setSelectedPresetId(presetId)
    toast.success(
      `Preset "${preset.name}" loaded. You can still add, remove or reorder members before saving.`,
    )
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
    savePresetToStore(name, assignments, draft.dutyRoles)
    setPresetDialogOpen(false)
    setPresetName('')
    toast.success(`Assignment preset "${name}" saved.`)
  }

  const moveAssignment = (target: SuguanAssignment, dir: -1 | 1) => {
    const idx = assignments.findIndex(
      (a) => a.memberId === target.memberId && a.voicePosition === target.voicePosition,
    )
    if (idx < 0) return
    const list = [...assignments]
    const current = list[idx]
    let swapIdx = -1
    for (let j = idx + dir; j >= 0 && j < list.length; j += dir) {
      if (list[j].voicePosition === current.voicePosition) {
        swapIdx = j
        break
      }
    }
    if (swapIdx >= 0) {
      list[idx] = list[swapIdx]
      list[swapIdx] = current
      fireAssignments(list)
    }
  }

  const groupGenders =
    draft.group === 'babae'
      ? ['female']
      : draft.group === 'lalaki'
        ? ['male']
        : ['female', 'male']
  const choirVoices = voices.filter((v) => groupGenders.includes(v.gender))
  const womanVoices = choirVoices.filter((v) => v.gender === 'female')
  const manVoices = choirVoices.filter((v) => v.gender === 'male')

  const hiddenAssignments = assignments.filter((a) => {
    const voice = voices.find((v) => v.id === a.voicePosition)
    return voice ? !groupGenders.includes(voice.gender) : false
  })

  const renderVoice = (voiceId: string) => {
    const sectionMembers = assignments.filter(
      (a) => a.voicePosition === voiceId,
    )
    const count = sectionMembers.length
    const isExpanded = expandedVoices.has(voiceId)
    const visibleMembers = isExpanded
      ? sectionMembers
      : sectionMembers.slice(0, MAX_VISIBLE_MEMBERS)
    const hiddenCount = count - MAX_VISIBLE_MEMBERS

    return (
      <Card key={voiceId}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold">
            {getVoiceName(voiceId, voices)}
          </CardTitle>
          <Badge
            variant="outline"
            className="bg-muted text-muted-foreground"
          >
            {count}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-col gap-1">
            {sectionMembers.length === 0 && (
              <p className="py-1 text-xs text-muted-foreground">
                No members assigned yet.
              </p>
            )}
            {visibleMembers.map((a) => {
              const conflicting = doubleBookedIds.has(a.memberId)
              return (
                <div
                  key={`${a.memberId}-${a.voicePosition}`}
                  className="flex items-center justify-between gap-2 rounded-md bg-muted px-2 py-1.5 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{a.memberName}</span>
                    {conflicting && (
                      <span className="flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="size-3" />
                        double-booked
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-6 text-muted-foreground hover:text-foreground"
                      title="Move up"
                      onClick={() => moveAssignment(a, -1)}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-6 text-muted-foreground hover:text-foreground"
                      title="Move down"
                      onClick={() => moveAssignment(a, 1)}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-6 text-muted-foreground hover:text-red-600"
                      onClick={() =>
                        fireAssignments(
                          assignments.filter(
                            (x) =>
                              !(x.memberId === a.memberId && x.voicePosition === a.voicePosition),
                          ),
                        )
                      }
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
          {count > MAX_VISIBLE_MEMBERS && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={() => toggleExpand(voiceId)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="size-3.5" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="size-3.5" />
                  Show all ({hiddenCount} more)
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setPickerVoice(voiceId)}
          >
            <Plus className="size-4" />
            Add Member
          </Button>
        </CardContent>
      </Card>
    )
  }

  const pickerVoiceMeta = pickerVoice
    ? (voices.find((v) => v.id === pickerVoice) ?? null)
    : null

  const eligibleCandidates = useMemo(() => {
    if (!pickerVoiceMeta) return []
    const groupGenders =
      draft.group === 'babae'
        ? ['female']
        : draft.group === 'lalaki'
          ? ['male']
          : ['female', 'male']
    return members
      .filter((m) => m.isActive)
      .filter((m) => groupGenders.includes(m.gender))
      .filter((m) => m.gender === pickerVoiceMeta.gender)
      .filter((m) => m.voicePosition === pickerVoice)
  }, [pickerVoice, pickerVoiceMeta, members, draft.group])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">
          {sectionTitle ?? 'Member Assignments'}
        </h2>
        <p className="text-sm text-muted-foreground">
          Assign members to each voice position. Only active members matching
          the chosen group and voice are offered as candidates.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <span className="text-sm font-medium">Load Assignment Preset:</span>
        <div className="min-w-56 flex-1">
          <Select
            value={selectedPresetId}
            onValueChange={loadPreset}
            disabled={presets.length === 0}
          >
            <SelectTrigger className="w-full">
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
        </div>
        {selectedPresetId && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-red-600"
            title="Delete this preset"
            onClick={() => {
              deletePresetFromStore(selectedPresetId)
              setSelectedPresetId('')
              toast.success('Preset deleted.')
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setPresetDialogOpen(true)}>
          <Save className="size-4" />
          Save current as Preset
        </Button>
      </div>

      {assignments.length === 0 && (
        <div className="rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          No members are assigned yet. Add members to at least one voice
          position before continuing.
        </div>
      )}

      {hiddenAssignments.length > 0 && (
        <div className="rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {hiddenAssignments.length} member
          {hiddenAssignments.length > 1 ? 's are' : ' is'} already assigned to a
          hidden voice section (from when the group was Mixed) and won't appear
          above for this {draft.group === 'babae' ? 'Babae' : 'Lalaki'} Suguan.
          Change the group back to Mixed to see and manage them.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {womanVoices.length > 0 && (
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Women's Choir
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">{womanVoices.map((v) => renderVoice(v.id))}</div>
          </div>
        )}
        {manVoices.length > 0 && (
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Men's Choir
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">{manVoices.map((v) => renderVoice(v.id))}</div>
          </div>
        )}
      </div>

      {includeDutyRoles && (
        <DutyRolesPanel
          draft={draft}
          patch={patch}
          members={members}
          roleIds={REGULAR_WORSHIP_DUTY_ROLES}
        />
      )}

      <Dialog open={!!pickerVoice} onOpenChange={(o) => !o && setPickerVoice(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pickerVoice ? getVoiceName(pickerVoice, voices) : ''} — Add Member
            </DialogTitle>
          </DialogHeader>
          {pickerVoice && (
            <MemberSelector
              candidates={eligibleCandidates}
              excludedIds={Array.from(assignedIds)}
              conflictIds={doubleBookedIds}
              onSelect={(members) => {
                fireAssignments([
                  ...assignments,
                  ...members.map((m) => ({
                    memberId: m.id,
                    memberName: `${m.firstName} ${m.lastName}`,
                    voicePosition: pickerVoice,
                    assignedAt: new Date().toISOString(),
                  })),
                ])
                setPickerVoice(null)
              }}
              onClose={() => setPickerVoice(null)}
              emptyMessage="No eligible active members with this voice position."
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save Assignment Preset</DialogTitle>
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
              {assignments.length} members and{' '}
              {includeDutyRoles ? draft.dutyRoles.length : 0} duty roles will be
              stored. Presets are a starting point — you can still change
              members when you load them.
            </p>
            <Button onClick={handleSavePreset}>
              <Save className="size-4" />
              Save Preset
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}