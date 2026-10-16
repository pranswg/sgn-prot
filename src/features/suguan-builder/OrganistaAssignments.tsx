import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { memberIsOrganist } from '@/core/constants/memberMembership'
import type { Member } from '@/core/types/member'
import type {
  ExtraOccasionOrganistaAssignment,
  ExtraOccasionOrganistaRole,
  SuguanScheduleSection,
} from '@/core/types/suguan'

const ORGANISTA_ROLES: { id: ExtraOccasionOrganistaRole; label: string }[] = [
  { id: 'organista', label: 'Organista' },
  { id: 'reserve', label: 'Reserbang Organista' },
]

function isOrganistaRole(value: string): value is ExtraOccasionOrganistaRole {
  return ORGANISTA_ROLES.some((role) => role.id === value)
}

export interface OrganistaAssignmentsConfig {
  schedules: SuguanScheduleSection[]
  assignments: Record<string, ExtraOccasionOrganistaAssignment[]>
  members: Member[]
  /** False renders the panel read-only for an account without the permission. */
  canAssign: boolean
  onChange: (next: Record<string, ExtraOccasionOrganistaAssignment[]>) => void
}

/**
 * The schedule-based organist picker: choose a schedule, an active Organista,
 * and the role (Organista or Reserbang Organista), then add or remove rows. It
 * lives in the Special Duties panel for sheets that print organista rows (the
 * Extra Occasion makers); the standard Choir Suguan sheet has no organista slot
 * and never renders it.
 */
export function OrganistaAssignments({
  schedules,
  assignments,
  members,
  canAssign,
  onChange,
}: OrganistaAssignmentsConfig) {
  const [scheduleId, setScheduleId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [role, setRole] = useState<ExtraOccasionOrganistaRole>('organista')

  const eligibleOrganistas = useMemo(
    () => members.filter((member) => member.isActive && memberIsOrganist(member)),
    [members],
  )
  const assignedIds = new Set(
    (assignments[scheduleId] ?? []).map((assignment) => assignment.memberId),
  )

  const addOrganista = () => {
    if (!scheduleId || !memberId) return
    onChange({
      ...assignments,
      [scheduleId]: [...(assignments[scheduleId] ?? []), { memberId, role }],
    })
    setMemberId('')
  }

  const removeOrganista = (targetScheduleId: string, targetMemberId: string) => {
    onChange({
      ...assignments,
      [targetScheduleId]: (assignments[targetScheduleId] ?? []).filter(
        (assignment) => assignment.memberId !== targetMemberId,
      ),
    })
  }

  if (schedules.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a service type and at least one Pagsasanay or Pagtupad date with
        assignments to assign Organista members.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {canAssign ? (
        <div className="grid gap-2">
          <Select value={scheduleId} onValueChange={setScheduleId}>
            <SelectTrigger aria-label="Organista schedule">
              <SelectValue placeholder="Choose schedule" />
            </SelectTrigger>
            <SelectContent>
              {schedules.map((schedule) => (
                <SelectItem key={schedule.id} value={schedule.id}>
                  {schedule.scheduleLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={memberId} onValueChange={setMemberId}>
            <SelectTrigger aria-label="Organista member">
              <SelectValue placeholder="Choose active Organista" />
            </SelectTrigger>
            <SelectContent>
              {eligibleOrganistas
                .filter((member) => !assignedIds.has(member.id))
                .map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.lastName}, {member.firstName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Select
              value={role}
              onValueChange={(value) => {
                if (isOrganistaRole(value)) setRole(value)
              }}
            >
              <SelectTrigger aria-label="Organista role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORGANISTA_ROLES.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={addOrganista}
              disabled={!scheduleId || !memberId}
              aria-label="Add Organista assignment"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Your role does not have permission to assign Organista members.
        </p>
      )}

      {schedules.map((schedule) => {
        const rows = assignments[schedule.id] ?? []
        if (rows.length === 0) return null
        return (
          <div key={schedule.id} className="space-y-2">
            <h4 className="text-xs font-semibold">{schedule.scheduleLabel}</h4>
            {rows.map((assignment) => {
              const member = members.find(
                (candidate) => candidate.id === assignment.memberId,
              )
              if (!member) return null
              return (
                <div
                  key={assignment.memberId}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span>
                    {member.lastName}, {member.firstName} —{' '}
                    {
                      ORGANISTA_ROLES.find(
                        (option) => option.id === assignment.role,
                      )?.label
                    }
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${member.firstName} from ${schedule.scheduleLabel}`}
                    onClick={() =>
                      removeOrganista(schedule.id, member.id)
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
