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
import { belongsInMasterList } from '@/lib/memberHistory'

export function DashboardPage() {
  const members = useMemberStore((s) => s.members)
  const trainees = useMemberStore((s) => s.trainees)
  const suguan = useSuguanStore((s) => s.suguan)
  const allServiceTypes = useSettingsStore((s) => s.allServiceTypes)
  const navigate = useNavStore((s) => s.navigate)
  const navigateToDirectory = useNavStore((s) => s.navigateToDirectory)
  const startNewSuguan = useNavStore((s) => s.startNewSuguan)
  const openSuguanDetail = useNavStore((s) => s.openSuguanDetail)

  // The cards navigate into the Master List, which excludes transferred-out
  // members, so they count the same roster the directory will show.
  const directoryMembers = members.filter(belongsInMasterList)
  const activeMembers = directoryMembers.filter((m) => m.isActive)
  const women = directoryMembers.filter((m) => m.gender === 'female')
  const men = directoryMembers.filter((m) => m.gender === 'male')
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
    allServiceTypes().find((t) => t.id === s.serviceTypeId)?.name ??
    s.serviceTypeId

  const stats = [
    { label: 'Total Members', value: directoryMembers.length, icon: Users, color: 'text-sky-600 dark:text-sky-400', go: () => navigateToDirectory('all') },
    { label: 'Active Members', value: activeMembers.length, icon: Music2, color: 'text-emerald-600 dark:text-emerald-400', go: () => navigateToDirectory('active') },
    { label: "Women's Choir", value: women.length, icon: Trophy, color: 'text-pink-600 dark:text-pink-400', go: () => navigateToDirectory('female') },
    { label: "Men's Choir", value: men.length, icon: Trophy, color: 'text-sky-600 dark:text-sky-400', go: () => navigateToDirectory('male') },
    { label: 'Trainees', value: activeTrainees.length, icon: GraduationCap, color: 'text-violet-600 dark:text-violet-400', go: () => navigate('trainees') },
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
          <button
            key={s.label}
            type="button"
            onClick={s.go}
            aria-label={`${s.label}: ${s.value}. Go to ${s.label}`}
            className="pressable group cursor-pointer rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transform-none"
          >
            <Card className="h-full transition-colors group-hover:bg-accent/40 group-hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted transition-colors group-hover:bg-card">
                  <s.icon className={`size-5 ${s.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-semibold leading-none">{s.value}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </button>
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
                className="pressable flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-accent motion-reduce:transform-none"
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
                className="pressable flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-accent motion-reduce:transform-none"
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