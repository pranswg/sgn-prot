import { useMemo } from 'react'
import {
  CalendarClock,
  CalendarPlus,
  Clock,
  GraduationCap,
  Music2,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useMemberStore } from '@/store/memberStore'
import { useSuguanStore } from '@/store/suguanStore'
import { useNavStore } from '@/store/navStore'
import { useSettingsStore } from '@/store/settingsStore'
import { formatDate, formatTime, isPast } from '@/lib/format'
import { dayOfMonthKey, monthShortKey } from '@/lib/phDate'

export function DashboardPage() {
  const members = useMemberStore((s) => s.members)
  const trainees = useMemberStore((s) => s.trainees)
  const suguan = useSuguanStore((s) => s.suguan)
  const allServiceTypes = useSettingsStore((s) => s.allServiceTypes)
  const navigate = useNavStore((s) => s.navigate)
  const startNewSuguan = useNavStore((s) => s.startNewSuguan)
  const openSuguanDetail = useNavStore((s) => s.openSuguanDetail)

  const activeMembers = members.filter((m) => m.isActive)
  const women = members.filter((m) => m.gender === 'female')
  const men = members.filter((m) => m.gender === 'male')
  const activeTrainees = trainees.filter((t) => t.status === 'active')

  const upcoming = useMemo(() => {
    return suguan
      .filter((s) => !isPast(s.date))
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
      .slice(0, 5)
  }, [suguan])

  const recent = useMemo(() => {
    return suguan
      .filter((s) => isPast(s.date))
      .sort(
        (a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`),
      )
      .slice(0, 4)
  }, [suguan])

  const recordLabel = (s: (typeof suguan)[number]) =>
    s.type === 'special'
      ? s.eventTitle || 'Special Occasion'
      : allServiceTypes().find((t) => t.id === s.serviceTypeId)?.name ??
        s.serviceTypeId

  const stats = [
    { label: 'Total Members', value: members.length, icon: Users, color: 'text-sky-600 dark:text-sky-400' },
    { label: 'Active Members', value: activeMembers.length, icon: Music2, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Active Trainees', value: activeTrainees.length, icon: GraduationCap, color: 'text-violet-600 dark:text-violet-400' },
    { label: "Women's Choir", value: women.length, icon: Trophy, color: 'text-pink-600 dark:text-pink-400' },
    { label: "Men's Choir", value: men.length, icon: Trophy, color: 'text-sky-600 dark:text-sky-400' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Dashboard"
        description="Overview of the choir's current state."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('master-list')}>
              <UserPlus className="size-4" />
              Manage Members
            </Button>
            <Button onClick={startNewSuguan}>
              <CalendarPlus className="size-4" />
              New Suguan
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-md bg-muted">
                <s.icon className={`size-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-semibold leading-none">{s.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Upcoming Suguan</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No upcoming Suguan scheduled.
              </p>
            )}
            {upcoming.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => openSuguanDetail(s.id)}
                className="flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-accent"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 flex-col items-center justify-center rounded-md bg-muted">
                    <span className="text-xs font-semibold leading-none">
                      {dayOfMonthKey(s.date)}
                    </span>
                    <span className="text-[10px] uppercase text-muted-foreground">
                      {monthShortKey(s.date)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{recordLabel(s)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(s.time)} · {s.assignments.length} assigned
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Recent Suguan</CardTitle>
            <CalendarClock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No past Suguan yet.
              </p>
            )}
            {recent.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => openSuguanDetail(s.id)}
                className="flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-accent"
              >
                <div>
                  <p className="text-sm font-medium">
                    {recordLabel(s)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(s.date)} · {s.assignments.length} members
                  </p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}