import { useState, type ReactNode } from 'react'
import {
  CalendarDays,
  CalendarRange,
  Clock,
  FileText,
  MapPin,
  Music,
  PenLine,
  Settings2,
  Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { DisclosureSection } from '@/components/DisclosureSection'
import { FieldCard, FieldCardGroup, FieldCardList } from '@/components/FieldCard'
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
 *
 * The fields are laid out as `FieldCard`s inside two `FieldCardGroup` columns,
 * so the form supplies its own card chrome and a host must not wrap it in a
 * second card. The two columns are built to come out the same length: the
 * Pagsasanay/Pagtupad panels sit side by side under Service type, and the
 * signatories toggle is the left column's last row.
 *
 * Choir assignments are the shared `AssignmentWorkspace` in its `occasion`
 * layout: one sheet section, so no schedule picker, two panels, and Special
 * Duties folded underneath. Every fold here is a `DisclosureSection`, which draws
 * one border around the row and the body it reveals.
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

  /**
   * Document setup starts collapsed, matching the Choir builder and the Organist
   * Suguan maker. `embedded` stops `DocumentSetupStep` from rendering a second
   * "Document setup" disclosure under this one.
   */
  const [documentSetupOpen, setDocumentSetupOpen] = useState(false)
  /**
   * Phones fold the two field groups away, so the page opens on the roster
   * instead of six cards of setup to scroll past. Every folded row states the
   * one thing that can still block a save.
   */
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [columnsOpen, setColumnsOpen] = useState(false)

  // The two optional printed columns, one panel each. Both are the same shape,
  // so they stay a single list rather than two hand-written blocks.
  const columnPanels = [
    {
      id: 'pagsasanay',
      /** Short name, for the folded row's summary. */
      short: 'Pagsasanay',
      title: 'Pagsasanay column',
      value: pagsasanay,
      setValue: (value: typeof pagsasanay) =>
        onChange({ ...state, pagsasanay: value }),
      accent: 'text-amber-700 dark:text-amber-300',
      panel:
        'border-amber-300/70 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/25',
    },
    {
      id: 'pagtupad',
      short: 'Pagtupad',
      title: 'Pagtupad column',
      value: pagtupad,
      setValue: (value: typeof pagtupad) =>
        onChange({ ...state, pagtupad: value }),
      accent: 'text-emerald-700 dark:text-emerald-300',
      panel:
        'border-emerald-300/70 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/25',
    },
  ]

  const serviceTypeName =
    serviceTypes.find((type) => type.id === draft.serviceTypeId)?.name ?? ''
  const groupLabel =
    GROUP_OPTIONS.find((group) => group.id === draft.group)?.label ?? ''

  /**
   * The folded "Occasion details" line. Service type is the first thing the save
   * gate checks, so a missing one is called out in amber rather than left
   * implicit behind a closed row.
   */
  const detailsSummary: ReactNode = serviceTypeName ? (
    <span className="text-muted-foreground">
      {[
        state.name.trim(),
        groupLabel,
        draft.schedules[0]?.scheduleTime,
        serviceTypeName,
      ]
        .filter(Boolean)
        .join(' · ')}
    </span>
  ) : (
    <span className="font-medium text-amber-600 dark:text-amber-400">
      Service type required
    </span>
  )

  /** Everything an enabled column needs before the sheet will print. */
  const unfinishedColumns = columnPanels
    .filter((panel) => panel.value.enabled)
    .map((panel) =>
      !panel.value.label.trim()
        ? `${panel.short} label`
        : !isDateKey(panel.value.date)
          ? `${panel.short} date`
          : null,
    )
    .filter((problem): problem is string => problem !== null)

  /**
   * The folded "Pagsasanay & Pagtupad" line: the printed dates, or what is
   * still missing.
   */
  const columnsSummary: ReactNode =
    unfinishedColumns.length > 0 ? (
      <span className="font-medium text-amber-600 dark:text-amber-400">
        {unfinishedColumns.join(' and ')} required
      </span>
    ) : (
      <span className="text-muted-foreground">
        {columnPanels
          .filter((panel) => panel.value.enabled)
          .map(
            (panel) =>
              `${panel.short} ${formatDateKeyNumeric(panel.value.date)}`,
          )
          .join(' · ') || 'Not printed on the sheet'}
      </span>
    )

  const occasionNameField = (
    <FieldCard
      icon={CalendarDays}
      label="Occasion name"
      tone="violet"
    >
      <Input
        id={`${idPrefix}-name`}
        value={state.name}
        onChange={(event) =>
          onChange({ ...state, name: event.target.value })
        }
        placeholder="e.g. Wedding"
      />
    </FieldCard>
  )

  const choirField = (
    <FieldCard icon={Music} label="Choir" tone="rose">
      <Select
        value={draft.group}
        onValueChange={(value) => {
          if (isSuguanGroup(value)) patch({ group: value })
        }}
      >
        <SelectTrigger className="w-full" aria-label="Choir group">
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
    </FieldCard>
  )

  const timeField = (
    <FieldCard icon={Clock} label="Time" tone="amber">
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
    </FieldCard>
  )

  const signatoriesField = (
    <FieldCard icon={PenLine} label="Signatories" tone="slate">
      <div className="flex items-center gap-2.5">
        <Checkbox
          id={`${idPrefix}-footer-signatories`}
          checked={showFooterSignatories}
          onCheckedChange={(checked) =>
            onChange({ ...state, showFooterSignatories: checked === true })
          }
        />
        <Label htmlFor={`${idPrefix}-footer-signatories`}>
          Include Pangulong Mang-aawit and Destinado signatories below the
          table
        </Label>
      </div>
    </FieldCard>
  )

  const localeField = (
    <FieldCard
      icon={MapPin}
      label="Locale Congregation Name"
      tone="emerald"
    >
      <Input
        id={`${idPrefix}-locale`}
        value={churchName}
        onChange={(event) =>
          onChange({ ...state, churchName: event.target.value })
        }
        placeholder="e.g. Sta. Monica"
      />
    </FieldCard>
  )

  const serviceTypeField = (
    <FieldCard icon={Settings2} label="Service type" required tone="sky">
      <Select
        value={draft.serviceTypeId}
        onValueChange={(value) =>
          onChange(applyServiceType(state, value, serviceTypes))
        }
      >
        <SelectTrigger
          id={`${idPrefix}-service-type`}
          className="w-full"
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
          No service types are configured. Add one in Settings to
          continue.
        </p>
      )}
    </FieldCard>
  )

  const columnsField = (
    <FieldCard
      icon={CalendarRange}
      label="Pagsasanay & Pagtupad"
      tone="slate"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {columnPanels.map(
          ({ id, title, value, setValue, accent, panel }) => (
            <div
              key={id}
              className={cn('space-y-3 rounded-xl border p-3', panel)}
            >
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
                  className={cn('font-semibold', accent)}
                >
                  Include {title}
                </Label>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor={`${idPrefix}-${id}-label`}
                  className="flex items-center gap-1.5 text-xs font-semibold"
                >
                  <Tag className="size-3.5 text-muted-foreground" />
                  Column label
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                </Label>
                <Input
                  id={`${idPrefix}-${id}-label`}
                  className="bg-background"
                  value={value.label}
                  disabled={!value.enabled}
                  onChange={(event) =>
                    setValue({ ...value, label: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor={`${idPrefix}-${id}-date`}
                  className="flex items-center gap-1.5 text-xs font-semibold"
                >
                  <CalendarDays className="size-3.5 text-muted-foreground" />
                  Date
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                </Label>
                <Input
                  id={`${idPrefix}-${id}-date`}
                  type="date"
                  className="bg-background"
                  value={value.date}
                  disabled={!value.enabled}
                  onChange={(event) =>
                    setValue({ ...value, date: event.target.value })
                  }
                />
              </div>
              {value.date && isDateKey(value.date) && (
                <p className="text-xs text-muted-foreground">
                  {formatDateKeyNumeric(value.date)}
                </p>
              )}
            </div>
          ),
        )}
      </div>
    </FieldCard>
  )

  return (
    <>
      {/*
        Phones fold the two groups of settings away, so the page opens on the
        roster instead of six cards of setup to scroll past. A folded row says
        what it holds, and calls out anything that still blocks a save. The
        desktop columns below stay open, as the design lays them out.
      */}
      <div>
        <div className="space-y-3 lg:hidden">
          <DisclosureSection
            open={detailsOpen}
            onToggle={() => setDetailsOpen((open) => !open)}
            icon={CalendarDays}
            title="Occasion details"
            summary={detailsSummary}
          >
            <FieldCardList>
              {occasionNameField}
              {choirField}
              {timeField}
              {serviceTypeField}
              {localeField}
              {signatoriesField}
            </FieldCardList>
          </DisclosureSection>

          <DisclosureSection
            open={columnsOpen}
            onToggle={() => setColumnsOpen((open) => !open)}
            icon={CalendarRange}
            title="Pagsasanay &amp; Pagtupad"
            summary={columnsSummary}
          >
            <FieldCardList>{columnsField}</FieldCardList>
          </DisclosureSection>
        </div>

        {/* The design lays both columns open from lg up. */}
        <div className="hidden gap-4 lg:grid lg:grid-cols-2">
          <FieldCardGroup>
            {occasionNameField}
            {choirField}
            {timeField}
            {signatoriesField}
          </FieldCardGroup>

          <FieldCardGroup>
            {localeField}
            {serviceTypeField}
            {columnsField}
          </FieldCardGroup>
        </div>
      </div>

      <DisclosureSection
        open={documentSetupOpen}
        onToggle={() => setDocumentSetupOpen((open) => !open)}
        icon={FileText}
        title="Document setup"
      >
        <div className="space-y-4 p-4">
          <p className="text-xs text-muted-foreground">
            Applies to the exported PDF, Excel, and Word files.
          </p>
          <DocumentSetupStep
            value={draft.docFormat}
            onChange={(docFormat) => patch({ docFormat })}
            embedded
          />
        </div>
      </DisclosureSection>

      {/* The workspace brings its own header, panels, and folded Special
          Duties, so this is not wrapped in a second card. */}
      <AssignmentWorkspace
        draft={draft}
        patch={patch}
        members={members}
        conflictIds={conflictIds}
        onMembersAdded={onMembersAdded}
        layout="occasion"
        organista={{
          schedules: draft.schedules,
          assignments: state.organistaAssignments,
          members,
          canAssign: canAssignMembers,
          onChange: (organistaAssignments) =>
            onChange({ ...state, organistaAssignments }),
        }}
      />
    </>
  )
}
