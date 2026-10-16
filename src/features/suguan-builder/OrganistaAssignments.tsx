import { useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
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

const CLEAR_VALUE = '__clear__'

/** The two organist fields, in the order the sheet prints them. */
const ORGANISTA_FIELDS: { role: ExtraOccasionOrganistaRole; label: string }[] = [
  { role: 'organista', label: 'Organista' },
  { role: 'reserve', label: 'Reserbang Organista' },
]

export interface OrganistaAssignmentsConfig {
  /**
   * The occasion's sheet sections. An Extra Occasion always renders exactly one,
   * so the fields read the first and ignore any others.
   */
  schedules: SuguanScheduleSection[]
  assignments: Record<string, ExtraOccasionOrganistaAssignment[]>
  members: Member[]
  /** False renders the panel read-only for an account without the permission. */
  canAssign: boolean
  onChange: (next: Record<string, ExtraOccasionOrganistaAssignment[]>) => void
}

function compareOrganistas(a: Member, b: Member): number {
  return (
    a.lastName.localeCompare(b.lastName, undefined, { sensitivity: 'base' }) ||
    a.firstName.localeCompare(b.firstName, undefined, { sensitivity: 'base' })
  )
}

/**
 * The organist picker: one single-member field per role — Organista and
 * Reserbang Organista. It lives in the Special Duties panel for sheets that
 * print organista rows (the Extra Occasion makers); the standard Choir Suguan
 * sheet has no organista slot and never renders it.
 *
 * Each field replaces that role's row outright, so a schedule holds at most one
 * member per role. The stored shape stays a row list per schedule, which keeps
 * already-saved Extra Occasion records readable.
 */
export function OrganistaAssignments({
  schedules,
  assignments,
  members,
  canAssign,
  onChange,
}: OrganistaAssignmentsConfig) {
  const schedule = schedules[0]
  const rows = schedule ? assignments[schedule.id] ?? [] : []

  const eligibleOrganistas = useMemo(
    () =>
      members
        .filter((member) => member.isActive && memberIsOrganist(member))
        .sort(compareOrganistas),
    [members],
  )

  const assignedIds = new Set(rows.map((row) => row.memberId))
  const memberFor = (role: ExtraOccasionOrganistaRole) =>
    rows.find((row) => row.role === role)?.memberId ?? ''

  const setRole = (role: ExtraOccasionOrganistaRole, memberId: string) => {
    if (!schedule) return
    const rest = rows.filter((row) => row.role !== role)
    onChange({
      ...assignments,
      [schedule.id]: memberId ? [...rest, { memberId, role }] : rest,
    })
  }

  if (!schedule) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a service type and at least one Pagsasanay or Pagtupad date with
        assignments to assign Organista members.
      </p>
    )
  }

  if (!canAssign) {
    return (
      <p className="text-sm text-muted-foreground">
        Your role does not have permission to assign Organista members.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {ORGANISTA_FIELDS.map(({ role, label }) => {
        const current = memberFor(role)
        return (
          <div key={role} className="grid gap-1.5">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {label}
            </span>
            <Select
              value={current}
              onValueChange={(value) =>
                setRole(role, value === CLEAR_VALUE ? '' : value)
              }
            >
              <SelectTrigger
                className="h-9 w-full bg-background"
                aria-label={label}
              >
                <SelectValue placeholder="Select member…" />
              </SelectTrigger>
              <SelectContent>
                {current && (
                  <>
                    <SelectItem value={CLEAR_VALUE}>
                      Clear assignment
                    </SelectItem>
                    <SelectSeparator />
                  </>
                )}
                {eligibleOrganistas
                  .filter(
                    (member) =>
                      member.id === current || !assignedIds.has(member.id),
                  )
                  .map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.lastName}, {member.firstName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )
      })}
    </div>
  )
}
