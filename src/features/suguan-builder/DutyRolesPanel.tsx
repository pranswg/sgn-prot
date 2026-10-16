import { useMemo } from 'react'
import { BadgeCheck, UserCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/store/settingsStore'
import { memberEffectivePositions } from '@/core/constants/memberMembership'
import {
  OIC_DUTY_ROLE_ID,
  resolveOicDutyRole,
} from '@/core/constants/dutyRoles'
import type { Member } from '@/core/types/member'
import type { SuguanDutyRole } from '@/core/types/suguan'
import { VoiceBadge } from '@/components/StatusBadges'
import { getVoiceName } from '@/core/constants/voicePositions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  OrganistaAssignments,
  type OrganistaAssignmentsConfig,
} from './OrganistaAssignments'

interface DutyRolesPanelProps {
  dutyRoles: SuguanDutyRole[]
  onDutyRolesChange: (dutyRoles: SuguanDutyRole[]) => void
  /** Required: printed on the right side of the signature block. */
  destinadoName: string
  onDestinadoChange: (name: string) => void
  members: Member[]
  title?: string
  scrollClassName?: string
  /** Hide the built-in header, for callers that render their own toggle above it. */
  hideHeader?: boolean
  /**
   * Lays the four fields out in two columns. The panel usually lives in a
   * narrow third column, where stacking them is right; the Extra Occasion
   * makers show it across a full-width page, where full-width inputs stacked
   * on top of each other are just noise.
   */
  wide?: boolean
  /**
   * Drop the panel's own card chrome, for a host that already draws the border
   * around it (the Extra Occasion Special Duties disclosure section).
   */
  flat?: boolean
  /**
   * When present, the schedule-based Organista picker renders inside this panel.
   * Only the Extra Occasion makers pass it: their sheet prints organista rows,
   * while the standard Choir Suguan sheet has no organista slot.
   */
  organista?: OrganistaAssignmentsConfig
}

const CLEAR_VALUE = '__clear__'

/**
 * Special Duties. The panel is deliberately a fixed set of fields — Destinado,
 * the Organista section when the sheet prints one, and OIC — rather than one
 * picker per configured ranking. Pangulong Mang-aawit and Kalihim are read from
 * the Master List, and Mang-aawit is the plain-singer default, so none of them
 * belong on this panel.
 */
export function DutyRolesPanel({
  dutyRoles,
  onDutyRolesChange,
  destinadoName,
  onDestinadoChange,
  members,
  title = 'Special Duties',
  scrollClassName = 'h-[460px]',
  hideHeader = false,
  wide = false,
  flat = false,
  organista,
}: DutyRolesPanelProps) {
  const allDutyRoles = useSettingsStore((s) => s.allDutyRoles)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const voices = allVoices()
  const destinadoId = 'suguan-destinado-name'

  const oicRole = resolveOicDutyRole(allDutyRoles())

  const activeMembers = useMemo(
    () =>
      members
        .filter((m) => m.isActive)
        .sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(
            `${b.lastName} ${b.firstName}`,
            undefined,
            { sensitivity: 'base' },
          ),
        ),
    [members],
  )

  // Only members the Master List marks with the OIC ranking can be picked,
  // mirroring how the Master List PDF groups its OIC section. The ranking is
  // whichever duty role `resolveOicDutyRole` found, whose id is usually
  // generated rather than the canonical `'oic'`; a legacy stored `oic` position
  // still counts.
  const oicCandidates = useMemo(
    () =>
      activeMembers.filter(
        (m) =>
          (oicRole
            ? m.assignedDutyRoleIds?.includes(oicRole.id) === true
            : false) || memberEffectivePositions(m).includes('oic'),
      ),
    [activeMembers, oicRole],
  )

  // A member can hold the legacy `oic` position without any OIC duty role being
  // configured, so those members alone are enough to show the field.
  const showOic = Boolean(oicRole) || oicCandidates.length > 0

  const currentOic = dutyRoles.find((d) => d.dutyRoleId === OIC_DUTY_ROLE_ID)
  const currentOicMember = currentOic
    ? activeMembers.find((m) => m.id === currentOic.memberId)
    : undefined

  const setOic = (member: Member) =>
    onDutyRolesChange([
      ...dutyRoles.filter((d) => d.dutyRoleId !== OIC_DUTY_ROLE_ID),
      {
        dutyRoleId: OIC_DUTY_ROLE_ID,
        memberId: member.id,
        memberName: `${member.firstName} ${member.lastName}`,
      },
    ])

  const clearOic = () =>
    onDutyRolesChange(
      dutyRoles.filter((d) => d.dutyRoleId !== OIC_DUTY_ROLE_ID),
    )

  const handleOicChange = (value: string) => {
    if (value === CLEAR_VALUE) {
      clearOic()
      return
    }
    const member = oicCandidates.find((m) => m.id === value)
    if (member) setOic(member)
  }

  return (
    <section
      className={cn(
        'flex h-full min-w-0 flex-col overflow-hidden',
        !flat && 'rounded-2xl border border-border/70 bg-card xl:rounded-lg',
      )}
    >
      {!hideHeader && (
        <header className="flex items-start gap-2.5 border-b border-border/70 px-4 py-3">
          <BadgeCheck className="mt-0.5 size-4 shrink-0 text-brand-navy/70" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              Assign officers and special roles for this Suguan.
            </p>
          </div>
        </header>
      )}

      <ScrollArea className={scrollClassName}>
        <div
          className={cn(
            'p-3',
            wide
              ? 'grid gap-4 sm:grid-cols-2'
              : 'flex flex-col gap-3 xl:gap-4 xl:p-4',
          )}
        >
          <div className="grid gap-1.5 rounded-2xl border border-border/60 bg-card p-3 shadow-[0_1px_2px_rgba(16,42,67,0.04)] xl:rounded-lg xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none">
            <label
              htmlFor={destinadoId}
              className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
            >
              Destinado{' '}
              <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <Input
              id={destinadoId}
              value={destinadoName}
              onChange={(e) => onDestinadoChange(e.target.value)}
              placeholder="Type the Destinado name…"
              className="h-9"
            />
            <p className="text-[11px] text-muted-foreground">
              Required. Printed on the right side of the signature block.
            </p>
          </div>

          {organista && (
            <div className="grid gap-2 rounded-2xl border border-border/60 bg-card p-3 shadow-[0_1px_2px_rgba(16,42,67,0.04)] xl:rounded-lg xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none">
              <OrganistaAssignments {...organista} />
            </div>
          )}

          {showOic && (
            <div className="grid gap-1.5 rounded-2xl border border-border/60 bg-card p-3 shadow-[0_1px_2px_rgba(16,42,67,0.04)] xl:rounded-lg xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {oicRole?.name ?? 'OIC'}
                </span>
                <span className="text-[0.625rem] font-medium tracking-wide text-muted-foreground/70">
                  {oicRole?.abbreviation ?? 'OIC'}
                </span>
              </div>

              {oicCandidates.length === 0 && !currentOic ? (
                <div className="flex h-9 items-center rounded-lg border border-dashed border-border bg-muted/40 px-3 text-sm text-muted-foreground">
                  No members hold the OIC ranking
                </div>
              ) : (
                <Select
                  value={currentOic?.memberId ?? ''}
                  onValueChange={handleOicChange}
                >
                  <SelectTrigger
                    className="h-9 w-full bg-background"
                    aria-label={oicRole?.name ?? 'OIC'}
                  >
                    <SelectValue placeholder="Select member…" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentOic && (
                      <>
                        <SelectItem value={CLEAR_VALUE}>
                          Clear assignment
                        </SelectItem>
                        <SelectSeparator />
                      </>
                    )}
                    {oicCandidates.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.firstName} {m.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {currentOic && currentOicMember && (
                <VoiceBadge
                  name={getVoiceName(currentOicMember.voicePosition, voices)}
                />
              )}

              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <UserCheck className="size-3 shrink-0" />
                Only members marked with the OIC ranking on the Master List.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </section>
  )
}
