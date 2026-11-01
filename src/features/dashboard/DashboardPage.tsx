import { useMemo, useState } from 'react'
import {
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  Clock,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Suguan } from '@/core/types/suguan'
import { useMemberStore } from '@/store/memberStore'
import { useSuguanStore } from '@/store/suguanStore'
import { useNavStore } from '@/store/navStore'
import { useSettingsStore } from '@/store/settingsStore'
import { CHOIR_PAGES } from '@/lib/sidebarNav'
import { membersOf, traineesOf } from '@/lib/choirs'
import { formatDate, formatTime, isPast } from '@/lib/format'
import { dayOfMonthKey, monthShortKey } from '@/lib/phDate'
import { belongsInMasterList } from '@/lib/memberHistory'

interface ChoirStat {
  label: string
  value: number
  go: () => void
  /** Phones show the three primary counts; Women/Men already head the Master List sections. */
  desktopOnly?: boolean
}

/** One choir band of the summary panel: counts inline, one link into its Master List. */
function ChoirSummary({
  title,
  stats,
  onOpen,
}: {
  title: string
  stats: ChoirStat[]
  onOpen: () => void
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-brand-teal-soft/35 px-4 py-2.5 sm:px-5">
        <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-foreground/75">
          {title}
        </h2>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1 rounded text-xs font-medium text-brand-teal transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="hidden sm:inline">Open Master List</span>
          <span className="sm:hidden">Open</span>
          <ArrowRight className="size-3.5" />
        </button>
      </div>
      <div
        className={cn(
          'grid grid-cols-3 divide-x divide-border/60',
          stats.length > 3 ? 'sm:grid-cols-5' : 'sm:grid-cols-3',
        )}
      >
        {stats.map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={stat.go}
            className={cn(
              'pressable flex flex-col items-start gap-1 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transform-none sm:px-5',
              stat.desktopOnly && 'hidden sm:flex',
            )}
          >
            <span className="text-xl font-semibold leading-none tabular-nums sm:text-2xl">
              {stat.value}
            </span>
            <span className="text-[0.6875rem] text-muted-foreground sm:text-xs">
              {stat.label}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function SuguanDateTile({ date }: { date: string }) {
  return (
    <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-teal-soft/40 leading-none">
      <span className="text-sm font-semibold tabular-nums">
        {dayOfMonthKey(date)}
      </span>
      <span className="mt-1 text-[0.5625rem] font-medium uppercase tracking-wide text-muted-foreground">
        {monthShortKey(date)}
      </span>
    </span>
  )
}

function SuguanRow({
  item,
  label,
  meta,
  onOpen,
}: {
  item: Suguan
  label: string
  meta: string
  onOpen: () => void
}) {
  return (
    <li className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        className="pressable flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transform-none"
      >
        <SuguanDateTile date={item.date} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{label}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {meta}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
      </button>
    </li>
  )
}

function SuguanCard({
  title,
  icon: Icon,
  items,
  count,
  empty,
  metaFor,
  labelFor,
  onOpen,
}: {
  title: string
  icon: LucideIcon
  items: Suguan[]
  /** Total saved records in this view, not just the rows the card previews. */
  count: number
  empty: string
  metaFor: (item: Suguan) => string
  labelFor: (item: Suguan) => string
  onOpen: (id: string) => void
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <header className="flex items-center gap-2.5 px-4 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-teal-soft/50 text-brand-teal">
          <Icon className="size-4" />
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums text-muted-foreground">
          {count}
        </span>
      </header>
      {items.length === 0 ? (
        <p className="border-t border-border/60 px-4 py-6 text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="border-t border-border/60">
          {items.map((item) => (
            <SuguanRow
              key={item.id}
              item={item}
              label={labelFor(item)}
              meta={metaFor(item)}
              onOpen={() => onOpen(item.id)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

export function DashboardPage() {
  const allMembers = useMemberStore((s) => s.members)
  const allTrainees = useMemberStore((s) => s.trainees)
  const suguan = useSuguanStore((s) => s.suguan)
  const allServiceTypes = useSettingsStore((s) => s.allServiceTypes)
  const navigate = useNavStore((s) => s.navigate)
  const navigateToDirectory = useNavStore((s) => s.navigateToDirectory)
  const startNewSuguan = useNavStore((s) => s.startNewSuguan)
  const openSuguanDetail = useNavStore((s) => s.openSuguanDetail)
  const [suguanView, setSuguanView] = useState<'upcoming' | 'recent'>('upcoming')

  // The two choirs are separate pools, so the cards count their own list. The
  // dashboard keeps one page: AWS rows first, then a PNK row.
  const members = useMemo(() => membersOf(allMembers, 'aws'), [allMembers])
  const trainees = useMemo(() => traineesOf(allTrainees, 'aws'), [allTrainees])
  const pnkMembers = useMemo(() => membersOf(allMembers, 'pnk'), [allMembers])
  const pnkTrainees = useMemo(
    () => traineesOf(allTrainees, 'pnk'),
    [allTrainees],
  )

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
  }, [suguan])

  const recent = useMemo(() => {
    return suguan
      .filter((s) => isPast(s.date))
      .sort(
        (a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`),
      )
  }, [suguan])

  const recordLabel = (s: Suguan) =>
    allServiceTypes().find((t) => t.id === s.serviceTypeId)?.name ??
    s.serviceTypeId

  const upcomingMeta = (s: Suguan) =>
    `${formatTime(s.time)} · ${s.assignments.length} assigned`
  const recentMeta = (s: Suguan) =>
    `${formatDate(s.date)} · ${s.assignments.length} members`

  const stats: ChoirStat[] = [
    {
      label: 'Members',
      value: directoryMembers.length,
      go: () => navigateToDirectory('all'),
    },
    {
      label: 'Active',
      value: activeMembers.length,
      go: () => navigateToDirectory('active'),
    },
    {
      label: 'Women',
      value: women.length,
      go: () => navigateToDirectory('female'),
      desktopOnly: true,
    },
    {
      label: 'Men',
      value: men.length,
      go: () => navigateToDirectory('male'),
      desktopOnly: true,
    },
    {
      label: 'Trainees',
      value: activeTrainees.length,
      go: () => navigate(CHOIR_PAGES.trainees.aws),
    },
  ]

  const pnkDirectoryMembers = pnkMembers.filter(belongsInMasterList)
  const pnkStats: ChoirStat[] = [
    {
      label: 'Members',
      value: pnkDirectoryMembers.length,
      go: () => navigate(CHOIR_PAGES.masterList.pnk),
    },
    {
      label: 'Active',
      value: pnkDirectoryMembers.filter((m) => m.isActive).length,
      go: () => navigate(CHOIR_PAGES.masterList.pnk),
    },
    {
      label: 'Trainees',
      value: pnkTrainees.filter((t) => t.status === 'active').length,
      go: () => navigate(CHOIR_PAGES.trainees.pnk),
    },
  ]

  const mobileTab =
    suguanView === 'upcoming'
      ? {
          items: upcoming.slice(0, 3),
          count: upcoming.length,
          empty: 'No upcoming Suguan scheduled.',
          metaFor: upcomingMeta,
        }
      : {
          items: recent.slice(0, 3),
          count: recent.length,
          empty: 'No past Suguan yet.',
          metaFor: recentMeta,
        }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <PageHeader
        title="Dashboard"
        description="AWS and PNK choirs at a glance."
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

      <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-card">
        <ChoirSummary
          title="AWS Choir"
          stats={stats}
          onOpen={() => navigateToDirectory('all')}
        />
        <ChoirSummary
          title="PNK Choir"
          stats={pnkStats}
          onOpen={() => navigate(CHOIR_PAGES.masterList.pnk)}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Suguan
          </h2>
          <button
            type="button"
            onClick={() => navigate('suguan-history')}
            className="inline-flex items-center gap-1 rounded text-xs font-medium text-brand-teal transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View history
            <ArrowRight className="size-3.5" />
          </button>
        </div>

        <div className="hidden gap-4 lg:grid lg:grid-cols-2">
          <SuguanCard
            title="Upcoming Suguan"
            icon={Clock}
            items={upcoming.slice(0, 5)}
            count={upcoming.length}
            empty="No upcoming Suguan scheduled."
            metaFor={upcomingMeta}
            labelFor={recordLabel}
            onOpen={openSuguanDetail}
          />
          <SuguanCard
            title="Recent Suguan"
            icon={CalendarClock}
            items={recent.slice(0, 4)}
            count={recent.length}
            empty="No past Suguan yet."
            metaFor={recentMeta}
            labelFor={recordLabel}
            onOpen={openSuguanDetail}
          />
        </div>

        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card lg:hidden">
          <div className="p-3">
            <div
              role="group"
              aria-label="Suguan view"
              className="grid grid-cols-2 gap-1 rounded-xl border border-border/60 bg-muted/40 p-1"
            >
              {(['upcoming', 'recent'] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  aria-pressed={suguanView === view}
                  onClick={() => setSuguanView(view)}
                  className={cn(
                    'flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    suguanView === view
                      ? 'bg-brand-teal-soft/70 text-brand-navy shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {view}
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-[0.625rem] font-semibold tabular-nums',
                      suguanView === view
                        ? 'bg-card/80 text-brand-navy'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {view === 'upcoming' ? upcoming.length : recent.length}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {mobileTab.items.length === 0 ? (
            <p className="border-t border-border/60 px-4 py-6 text-sm text-muted-foreground">
              {mobileTab.empty}
            </p>
          ) : (
            <ul className="border-t border-border/60">
              {mobileTab.items.map((item) => (
                <SuguanRow
                  key={item.id}
                  item={item}
                  label={recordLabel(item)}
                  meta={mobileTab.metaFor(item)}
                  onOpen={() => openSuguanDetail(item.id)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
