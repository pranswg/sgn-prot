import {
  ArrowLeft,
  CalendarDays,
  Music2,
  Pencil,
  ShieldCheck,
  Users,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  GenderBadge,
  MemberStatusBadge,
  MembershipBadge,
  VoiceBadge,
} from '@/components/StatusBadges'
import { MemberInitialsAvatar } from './MemberInitialsAvatar'
import { MemberPositionsCell } from './MemberPositionsCell'
import { getVoiceName } from '@/core/constants/voicePositions'
import { positionSummary } from '@/core/constants/choirPositions'
import { formatDate } from '@/lib/format'
import type { Member } from '@/core/types/member'
import { formatMemberName, type MemberSort } from '@/lib/memberDirectory'
import { useSuguanStore } from '@/store/suguanStore'
import { useSettingsStore } from '@/store/settingsStore'

interface MemberProfileSheetProps {
  member: Member | null
  reference?: string
  sort?: MemberSort
  onOpenChange: (open: boolean) => void
  onEdit: (member: Member) => void
  onAssign: (member: Member) => void
}

/** Full-height mobile profile screen with Overview / Positions / History tabs. */
export function MemberProfileSheet({
  member,
  reference,
  sort = 'last-name',
  onOpenChange,
  onEdit,
  onAssign,
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

          <Tabs defaultValue="overview">
            <TabsList className="w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="positions">Positions</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-3">
              <dl className="grid grid-cols-2 gap-2">
                <InfoCard
                  icon={Users}
                  label="Gender"
                  value={<GenderBadge gender={member.gender} />}
                />
                <InfoCard
                  icon={Music2}
                  label="Voice"
                  value={
                    <VoiceBadge
                      name={getVoiceName(member.voicePosition, voiceMap)}
                    />
                  }
                />
                <InfoCard
                  icon={ShieldCheck}
                  label="Membership"
                  value={<MembershipBadge type={member.membershipType} />}
                />
                <InfoCard
                  icon={CalendarDays}
                  label="Date Added"
                  value={
                    <span className="text-[0.8125rem] font-medium">
                      {formatDate(member.dateAdded)}
                    </span>
                  }
                />
              </dl>
              {member.notes && (
                <p className="mt-3 rounded-lg border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground">
                  {member.notes}
                </p>
              )}
            </TabsContent>

            <TabsContent value="positions" className="mt-3">
              {member.positions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  No choir positions assigned.
                </p>
              ) : (
                <>
                  <MemberPositionsCell positions={member.positions} max={99} />
                  <p className="mt-3 text-xs text-muted-foreground">
                    {positionSummary(member.positions)}
                  </p>
                </>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-3">
              {history.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  No Suguan assignments yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {history.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card px-3 py-2.5"
                    >
                      <div className="min-w-0 leading-tight">
                        <p className="truncate text-[0.8125rem] font-medium text-foreground">
                          {s.eventTitle || s.serviceTypeId || 'Suguan'}
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
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border/70 bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              onOpenChange(false)
              onAssign(member)
            }}
          >
            <CalendarDays className="size-4" />
            Assign
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

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border/70 bg-card p-3">
      <dt className="flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  )
}
