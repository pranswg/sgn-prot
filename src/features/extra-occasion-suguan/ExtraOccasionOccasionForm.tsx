import { CalendarDays } from 'lucide-react'
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
  applyServiceType,
  applyTime,
  type ExtraOccasionOccasionState,
} from './extraOccasionDraft'

const GROUP_OPTIONS: { id: SuguanGroup; label: string }[] = [
  { id: 'babae', label: "Women's Choir" },
  { id: 'lalaki', label: "Men's Choir" },
  { id: 'mixed', label: 'Mixed Choir' },
]

function isSuguanGroup(value: string): value is SuguanGroup {
  return GROUP_OPTIONS.some((group) => group.id === value)
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
 * time, the Pagsasanay/Pagtupad columns, signatories, document setup, and choir
 * assignments (whose Special Duties panel carries the Organista picker). Shared
 * by the single maker and the Multiple planner so both stay identical.
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

  const patch = (value: Partial<typeof draft>) =>
    onChange({ ...state, draft: { ...draft, ...value } })

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
          voice-sectioned list, and the Organista picker lives in Special
          Duties.
        </p>
        <AssignmentWorkspace
          draft={draft}
          patch={patch}
          members={members}
          conflictIds={conflictIds}
          onMembersAdded={onMembersAdded}
          organista={{
            schedules: draft.schedules,
            assignments: state.organistaAssignments,
            members,
            canAssign: canAssignMembers,
            onChange: (organistaAssignments) =>
              onChange({ ...state, organistaAssignments }),
          }}
        />
      </div>
    </>
  )
}
