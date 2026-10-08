import { useMemo } from 'react'
import { AlertTriangle, BadgeCheck, UserCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSettingsStore } from '@/store/settingsStore'
import { CHOIR_SUGUAN_EXCLUDED_DUTY_ROLE_IDS } from '@/core/constants/dutyRoles'
import type { Member } from '@/core/types/member'
import type { SuguanDutyRole } from '@/core/types/suguan'
import {
  DUTY_ROLE_REQUIRED_POSITIONS,
  memberCanHoldDutyRole,
  POSITION_LABELS,
} from '@/core/constants/choirPositions'
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

interface DutyRolesPanelProps {
  dutyRoles: SuguanDutyRole[]
  onDutyRolesChange: (dutyRoles: SuguanDutyRole[]) => void
  destinadoName: string
  onDestinadoChange: (name: string) => void
  members: Member[]
  roleIds?: string[]
  title?: string
  scrollClassName?: string
  /** Hide the built-in header, for callers that render their own toggle above it. */
  hideHeader?: boolean
}

const CLEAR_VALUE = '__clear__'

/**
 * Roles kept out of the Special Duties picker. The Pangulong Mang-aawit is
 * read straight from the master list by `resolveSignatureNames` and printed on
 * the exported sheet from there, so picking it here would only be a second
 * source of truth. The Kalihim has no printed slot at all, and the organist
 * roles belong to the Organist Suguan — see
 * `CHOIR_SUGUAN_EXCLUDED_DUTY_ROLE_IDS`.
 */
const HIDDEN_DUTY_ROLE_IDS = new Set([
  'pangulong-mang-aawit',
  'kalihim',
  ...CHOIR_SUGUAN_EXCLUDED_DUTY_ROLE_IDS,
])

/**
 * Preferred display order for duty roles. Roles not listed here (custom roles
 * such as a user-added "Atpa", or the remaining standard ones) keep their
 * stored order after these, so Settings stays the source of truth.
 */
const ROLE_ORDER = ['pangulong-mang-aawit', 'organista', 'atpa', 'oic']

function roleRank(id: string): number {
  const index = ROLE_ORDER.indexOf(id)
  return index === -1 ? ROLE_ORDER.length : index
}

function eligiblePositionText(roleId: string): string {
  const required = DUTY_ROLE_REQUIRED_POSITIONS[roleId]
  if (!required) return ''
  return required.map((p) => POSITION_LABELS[p]).join(' / ')
}

export function DutyRolesPanel({
  dutyRoles,
  onDutyRolesChange,
  destinadoName,
  onDestinadoChange,
  members,
  roleIds,
  title = 'Special Duties',
  scrollClassName = 'h-[460px]',
  hideHeader = false,
}: DutyRolesPanelProps) {
  const allDutyRoles = useSettingsStore((s) => s.allDutyRoles)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const voices = allVoices()
  const destinoListId = 'suguan-destinado-name'

  const roles = allDutyRoles()
    .filter((role) => !roleIds || roleIds.includes(role.id))
    .filter((role) => !HIDDEN_DUTY_ROLE_IDS.has(role.id))
    .slice()
    .sort((a, b) => roleRank(a.id) - roleRank(b.id))

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

  const dutyRoleCounts = new Map<string, number>()
  for (const d of dutyRoles) {
    dutyRoleCounts.set(d.memberId, (dutyRoleCounts.get(d.memberId) ?? 0) + 1)
  }
  const duplicateIds = new Set(
    [...dutyRoleCounts.entries()]
      .filter(([, c]) => c > 1)
      .map(([id]) => id),
  )

  const getDuty = (roleId: string) => dutyRoles.find((d) => d.dutyRoleId === roleId)

  const candidatesFor = (roleId: string) =>
    activeMembers.filter(
      (m) =>
        memberCanHoldDutyRole(m, roleId) &&
        !dutyRoles.some((d) => d.memberId === m.id && d.dutyRoleId !== roleId),
    )

  const setDuty = (roleId: string, member: Member) =>
    onDutyRolesChange([
      ...dutyRoles.filter((d) => d.dutyRoleId !== roleId),
      {
        dutyRoleId: roleId,
        memberId: member.id,
        memberName: `${member.firstName} ${member.lastName}`,
      },
    ])

  const clearDuty = (roleId: string) =>
    onDutyRolesChange(dutyRoles.filter((d) => d.dutyRoleId !== roleId))

  const handleChange = (roleId: string, value: string) => {
    if (value === CLEAR_VALUE) {
      clearDuty(roleId)
      return
    }
    const member = activeMembers.find((m) => m.id === value)
    if (member) setDuty(roleId, member)
  }

  return (
    <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card xl:rounded-lg">
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
        <div className="flex flex-col gap-3 p-3 xl:gap-4 xl:p-4">
          {duplicateIds.size > 0 && (
            <p className="flex items-start gap-1.5 rounded-md border border-red-400/50 bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950/30 dark:text-red-200">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              A member cannot hold more than one duty role in the same Suguan.
            </p>
          )}

          <div className="grid gap-1.5 rounded-2xl border border-border/60 bg-card p-3 shadow-[0_1px_2px_rgba(16,42,67,0.04)] xl:rounded-lg xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none">
            <label
              htmlFor={destinoListId}
              className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
            >
              Destinado
            </label>
            <Input
              id={destinoListId}
              list={`${destinoListId}-options`}
              value={destinadoName}
              onChange={(e) => onDestinadoChange(e.target.value)}
              placeholder="Select or type a name…"
              className="h-9"
            />
            <datalist id={`${destinoListId}-options`}>
              {activeMembers.map((m) => (
                <option key={m.id} value={`${m.firstName} ${m.lastName}`} />
              ))}
            </datalist>
            <p className="text-[11px] text-muted-foreground">
              Printed on the right side of the signature block.
            </p>
          </div>

          <div className="flex flex-col gap-3.5">
            {roles.map((role) => {
              const current = getDuty(role.id)
              const currentMember = current
                ? activeMembers.find((m) => m.id === current.memberId)
                : undefined
              const candidates = candidatesFor(role.id)
              const eligibleText = eligiblePositionText(role.id)
              const isDuplicate = current && duplicateIds.has(current.memberId)

              return (
                <div
                  key={role.id}
                  className="grid gap-1.5 rounded-2xl border border-border/60 bg-card p-3 shadow-[0_1px_2px_rgba(16,42,67,0.04)] xl:rounded-lg xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      {role.name}
                    </span>
                    <span className="text-[0.625rem] font-medium tracking-wide text-muted-foreground/70">
                      {role.abbreviation}
                    </span>
                  </div>

                  {candidates.length === 0 && !current ? (
                    <div className="flex h-9 items-center rounded-lg border border-dashed border-border bg-muted/40 px-3 text-sm text-muted-foreground">
                      No eligible members
                    </div>
                  ) : (
                    <Select
                      value={current?.memberId ?? ''}
                      onValueChange={(v) => handleChange(role.id, v)}
                    >
                      <SelectTrigger
                        className="h-9 w-full bg-background"
                        aria-label={role.name}
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
                        {candidates.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.firstName} {m.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {current && currentMember && (
                    <div className="flex items-center gap-1.5">
                      <VoiceBadge
                        name={getVoiceName(currentMember.voicePosition, voices)}
                      />
                      {isDuplicate && (
                        <span className="text-[11px] font-medium text-red-600 dark:text-red-400">
                          duplicate role
                        </span>
                      )}
                    </div>
                  )}

                  {eligibleText && (
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <UserCheck className="size-3 shrink-0" />
                      {eligibleText}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </ScrollArea>
    </section>
  )
}
