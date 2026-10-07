import {
  ArrowLeft,
  CalendarDays,
  Music2,
  Pencil,
  ShieldCheck,
  User,
  UserCheck,
  UserX,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  GenderBadge,
  MemberStatusBadge,
  MembershipBadge,
  PositionBadge,
  VoiceBadge,
} from '@/components/StatusBadges'
import { MemberInitialsAvatar } from './MemberInitialsAvatar'
import { getVoiceName } from '@/core/constants/voicePositions'
import { formatDate } from '@/lib/format'
import type { Member } from '@/core/types/member'
import { memberEffectivePositions } from '@/core/constants/memberMembership'
import { formatMemberName, type MemberSort } from '@/lib/memberDirectory'
import { useSuguanStore } from '@/store/suguanStore'
import { useSettingsStore } from '@/store/settingsStore'

interface MemberProfileSheetProps {
  member: Member | null
  reference?: string
  sort?: MemberSort
  onOpenChange: (open: boolean) => void
  onEdit: (member: Member) => void
  /** Deactivate an active member, or reactivate an inactive one. */
  onToggleStatus: (member: Member) => void
}

/**
 * Full-height mobile profile. The info is stacked as plain cards rather than
 * tabs so the whole record reads as one scroll: personal details, voice
 * assignment, privileges, then the real Suguan history.
 */
export function MemberProfileSheet({
  member,
  reference,
  sort = 'last-name',
  onOpenChange,
  onEdit,
  onToggleStatus,
}: MemberProfileSheetProps) {
  const allVoices = useSettingsStore((s) => s.allVoices)
  const suguanList = useSuguanStore((s) => s.suguan)
  const voiceMap = allVoices()

  if (!member) {
    return <Sheet open={false} onOpenChange={onOpenChange} />
  }

  const name = formatMemberName(member, sort)

  // History is derived from real Suguan rosters, not a placeholder.
  const history = suguanList
    .filter((s) => s.assignments.some((a) => a.memberId === member.id))
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[92vh] gap-0 overflow-hidden rounded-t-2xl pb-0"
      >
        <SheetHeader className="shrink-0 border-b border-border/70 p-4 pb-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              className="-ml-1"
              aria-label="Back to member list"
              onClick={() => onOpenChange(false)}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-0">
              <SheetTitle className="text-sm">Member Profile</SheetTitle>
              <SheetDescription className="truncate text-xs">
                {name}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="-mx-4 flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col items-center gap-2 pb-5 text-center">
            <MemberInitialsAvatar
              member={member}
              sort={sort}
              className="size-16 text-lg"
            />
            <div>
              <p className="text-base font-semibold tracking-tight text-foreground">
                {name}
              </p>
              <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                {reference ?? '—'}
              </p>
            </div>
            <MemberStatusBadge active={member.isActive} />
          </div>

          <div className="flex flex-col gap-3">
            <ProfileCard title="Personal Information" icon={User}>
              <InfoRow label="Gender">
                <GenderBadge gender={member.gender} />
              </InfoRow>
              <InfoRow label="Membership">
                <MembershipBadge type={member.membershipType} />
              </InfoRow>
            </ProfileCard>

            <ProfileCard title="Voice Assignment" icon={Music2}>
              <InfoRow label="Voice Position">
                <VoiceBadge
                  name={getVoiceName(member.voicePosition, voiceMap)}
                />
              </InfoRow>
            </ProfileCard>

            <ProfileCard title="Roles" icon={ShieldCheck}>
              {memberEffectivePositions(member).length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                  No choir roles assigned.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {memberEffectivePositions(member).map((position) => (
                    <PositionBadge key={position} position={position} />
                  ))}
                </div>
              )}
            </ProfileCard>

            <ProfileCard title="Assignment History" icon={CalendarDays}>
              {history.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                  No Suguan assignments yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {history.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background px-3 py-2.5"
                    >
                      <div className="min-w-0 leading-tight">
                        <p className="truncate text-[0.8125rem] font-medium text-foreground">
                          {s.serviceTypeId || 'Suguan'}
                        </p>
                        <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
                          {formatDate(s.date)}
                        </p>
                      </div>
                      <span className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground">
                        {
                          s.assignments.filter((a) => a.memberId === member.id)
                            .length
                        }{' '}
                        slot
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </ProfileCard>
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border/70 bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              onOpenChange(false)
              onToggleStatus(member)
            }}
          >
            {member.isActive ? (
              <>
                <UserX className="size-4" />
                Deactivate
              </>
            ) : (
              <>
                <UserCheck className="size-4" />
                Reactivate
              </>
            )}
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onOpenChange(false)
              onEdit(member)
            }}
          >
            <Pencil className="size-4" />
            Edit Member
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ProfileCard({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof User
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-card p-3.5 shadow-sm">
      <h3 className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
      </h3>
      <div className="mt-3 flex flex-col gap-2.5">{children}</div>
    </section>
  )
}

function InfoRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right leading-tight">{children}</span>
    </div>
  )
}
