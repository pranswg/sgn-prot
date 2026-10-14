import { useMemo, useState } from 'react'
import { CalendarDays, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDateKeyNumeric, isDateKey } from '@/lib/phDate'
import type { Member } from '@/core/types/member'
import type { ServiceType, SuguanGroup } from '@/core/types/suguan'
import { AssignmentWorkspace } from '@/features/suguan-builder/AssignmentWorkspace'
import { DocumentSetupStep } from '@/features/suguan-builder/DocumentSetupStep'
import {
  memberIsEligibleExtraOrganista,
  type ExtraOrganistaAssignment,
  type ExtraOrganistaRole,
} from './extraOccasionData'
import {
  applyServiceType,
  applyTime,
  type ExtraOccasionOccasionState,
} from './extraOccasionDraft'

const GROUP_OPTIONS: { id: SuguanGroup; label: string }[] = [
  { id: 'babae', label: "Women's Choir" },
  { id: 'lalaki', label: "Men's Choir" },
  { id: 'mixed', label: 'Mixed Choir' },
]

const ORGANISTA_ROLES: { id: ExtraOrganistaRole; label: string }[] = [
  { id: 'organista', label: 'Organista' },
  { id: 'reserve', label: 'Reserbang Organista' },
]

function isSuguanGroup(value: string): value is SuguanGroup {
  return GROUP_OPTIONS.some((group) => group.id === value)
}

function isOrganistaRole(value: string): value is ExtraOrganistaRole {
  return ORGANISTA_ROLES.some((role) => role.id === value)
}

interface ExtraOccasionOccasionFormProps {
  state: ExtraOccasionOccasionState
  onChange: (next: ExtraOccasionOccasionState) => void
  members: Member[]
  serviceTypes: ServiceType[]
  canAssignMembers: boolean
  /** Distinguishes DOM ids when several copies could render. */
  idPrefix?: string
  /** Members already booked elsewhere, flagged in the assignment workspace. */
  conflictIds?: Set<string>
  /** Fires with the ids newly added to the roster, for conflict resolution. */
  onMembersAdded?: (memberIds: string[]) => void
}

/**
 * The configuration half of an Extra Occasion: locale, choir, service, custom
 * time, the Pagsasanay/Pagtupad columns, signatories, document setup, choir
 * assignments, and the Organista section. Shared by the single maker and the
 * Multiple planner so both stay identical.
 */
export function ExtraOccasionOccasionForm({
  state,
  onChange,
  members,
  serviceTypes,
  canAssignMembers,
  idPrefix = 'extra-occasion',
  conflictIds,
  onMembersAdded,
}: ExtraOccasionOccasionFormProps) {
  const { draft, churchName, pagsasanay, pagtupad, showFooterSignatories } = state
  const [organistaScheduleId, setOrganistaScheduleId] = useState('')
  const [organistaMemberId, setOrganistaMemberId] = useState('')
  const [organistaRole, setOrganistaRole] =
    useState<ExtraOrganistaRole>('organista')

  const patch = (value: Partial<typeof draft>) =>
    onChange({ ...state, draft: { ...draft, ...value } })

  const eligibleOrganistas = useMemo(
    () => members.filter(memberIsEligibleExtraOrganista),
    [members],
  )
  const assignedOrganistaIds = new Set(
    (state.organistaAssignments[organistaScheduleId] ?? []).map(
      (assignment) => assignment.memberId,
    ),
  )

  const setOrganistaAssignments = (
    next: Record<string, ExtraOrganistaAssignment[]>,
  ) => onChange({ ...state, organistaAssignments: next })

  const addOrganista = () => {
    if (!organistaScheduleId || !organistaMemberId) return
    setOrganistaAssignments({
      ...state.organistaAssignments,
      [organistaScheduleId]: [
        ...(state.organistaAssignments[organistaScheduleId] ?? []),
        { memberId: organistaMemberId, role: organistaRole },
      ],
    })
    setOrganistaMemberId('')
  }

  const removeOrganista = (scheduleId: string, memberId: string) => {
    setOrganistaAssignments({
      ...state.organistaAssignments,
      [scheduleId]: (state.organistaAssignments[scheduleId] ?? []).filter(
        (assignment) => assignment.memberId !== memberId,
      ),
    })
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-name`}>Occasion name</Label>
          <Input
            id={`${idPrefix}-name`}
            value={state.name}
            onChange={(event) => onChange({ ...state, name: event.target.value })}
            placeholder="e.g. Wedding"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-locale`}>Locale Congregation Name</Label>
          <Input
            id={`${idPrefix}-locale`}
            value={churchName}
            onChange={(event) =>
              onChange({ ...state, churchName: event.target.value })
            }
            placeholder="e.g. Sta. Monica"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Choir</Label>
          <Select
            value={draft.group}
            onValueChange={(value) => {
              if (isSuguanGroup(value)) patch({ group: value })
            }}
          >
            <SelectTrigger aria-label="Choir group">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUP_OPTIONS.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-service-type`}>Service type</Label>
          <Select
            value={draft.serviceTypeId}
            onValueChange={(value) =>
              onChange(applyServiceType(state, value, serviceTypes))
            }
          >
            <SelectTrigger
              id={`${idPrefix}-service-type`}
              aria-label="Service type"
            >
              <SelectValue placeholder="Select a service type" />
            </SelectTrigger>
            <SelectContent>
              {serviceTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {serviceTypes.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No service types are configured. Add one in Settings to continue.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-time`}>Custom time</Label>
          <Input
            id={`${idPrefix}-time`}
            type="time"
            value={draft.time}
            onChange={(event) => onChange(applyTime(state, event.target.value))}
          />
          {draft.schedules[0]?.scheduleTime && (
            <p className="text-xs text-muted-foreground">
              Displayed on sheet as {draft.schedules[0].scheduleTime}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[
          {
            id: 'pagsasanay',
            title: 'Pagsasanay column',
            value: pagsasanay,
            setValue: (value: typeof pagsasanay) =>
              onChange({ ...state, pagsasanay: value }),
            accent: 'text-amber-700',
          },
          {
            id: 'pagtupad',
            title: 'Pagtupad column',
            value: pagtupad,
            setValue: (value: typeof pagtupad) =>
              onChange({ ...state, pagtupad: value }),
            accent: 'text-emerald-700',
          },
        ].map(({ id, title, value, setValue, accent }) => (
          <div key={id} className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`${idPrefix}-${id}-enabled`}
                checked={value.enabled}
                onCheckedChange={(checked) =>
                  setValue({ ...value, enabled: checked === true })
                }
              />
              <Label
                htmlFor={`${idPrefix}-${id}-enabled`}
                className={`font-semibold ${accent}`}
              >
                Include {title}
              </Label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-${id}-label`}>Column label</Label>
                <Input
                  id={`${idPrefix}-${id}-label`}
                  value={value.label}
                  disabled={!value.enabled}
                  onChange={(event) =>
                    setValue({ ...value, label: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-${id}-date`}>Custom date</Label>
                <Input
                  id={`${idPrefix}-${id}-date`}
                  type="date"
                  value={value.date}
                  disabled={!value.enabled}
                  onChange={(event) =>
                    setValue({ ...value, date: event.target.value })
                  }
                />
              </div>
            </div>
            {value.date && isDateKey(value.date) && (
              <p className="text-xs text-muted-foreground">
                {formatDateKeyNumeric(value.date)}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id={`${idPrefix}-footer-signatories`}
          checked={showFooterSignatories}
          onCheckedChange={(checked) =>
            onChange({ ...state, showFooterSignatories: checked === true })
          }
        />
        <Label htmlFor={`${idPrefix}-footer-signatories`}>
          Include Pangulong Mang-aawit and Destinado signatories below the table
        </Label>
      </div>

      <details>
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
          <CalendarDays className="size-4" />
          Document setup
        </summary>
        <div className="mt-4">
          <DocumentSetupStep
            value={draft.docFormat}
            onChange={(docFormat) => patch({ docFormat })}
          />
        </div>
      </details>

      <div className="rounded-lg border p-3">
        <h3 className="mb-2 text-sm font-semibold">Choir assignments</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Assign members to this Extra Occasion. All assignments appear in one
          voice-sectioned list.
        </p>
        <AssignmentWorkspace
          draft={draft}
          patch={patch}
          members={members}
          conflictIds={conflictIds}
          onMembersAdded={onMembersAdded}
        />
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <div>
          <h3 className="text-sm font-semibold">Organista section</h3>
          <p className="text-xs text-muted-foreground">
            Add active Organista members to each schedule and choose their role.
          </p>
        </div>
        {draft.schedules.length > 0 ? (
          <>
            {canAssignMembers ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <Select
                  value={organistaScheduleId}
                  onValueChange={setOrganistaScheduleId}
                >
                  <SelectTrigger aria-label="Organista schedule">
                    <SelectValue placeholder="Choose schedule" />
                  </SelectTrigger>
                  <SelectContent>
                    {draft.schedules.map((schedule) => (
                      <SelectItem key={schedule.id} value={schedule.id}>
                        {schedule.scheduleLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={organistaMemberId}
                  onValueChange={setOrganistaMemberId}
                >
                  <SelectTrigger aria-label="Organista member">
                    <SelectValue placeholder="Choose active Organista" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleOrganistas
                      .filter((member) => !assignedOrganistaIds.has(member.id))
                      .map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.lastName}, {member.firstName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Select
                    value={organistaRole}
                    onValueChange={(value) => {
                      if (isOrganistaRole(value)) setOrganistaRole(value)
                    }}
                  >
                    <SelectTrigger aria-label="Organista role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORGANISTA_ROLES.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addOrganista}
                    disabled={!organistaScheduleId || !organistaMemberId}
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
            {draft.schedules.map((schedule) => {
              const rows = state.organistaAssignments[schedule.id] ?? []
              if (rows.length === 0) return null
              return (
                <div key={schedule.id} className="space-y-2">
                  <h4 className="text-xs font-semibold">
                    {schedule.scheduleLabel}
                  </h4>
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
                          {ORGANISTA_ROLES.find(
                            (role) => role.id === assignment.role,
                          )?.label}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${member.firstName} from ${schedule.scheduleLabel}`}
                          onClick={() => removeOrganista(schedule.id, member.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Add a service type and at least one Pagsasanay or Pagtupad date with
            assignments to assign Organista members.
          </p>
        )}
      </div>
    </>
  )
}
