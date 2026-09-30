import { GraduationCap, Music2, ShieldCheck, Users } from 'lucide-react'
import type { DirectoryStats } from '@/lib/memberDirectory'
import { cn } from '@/lib/utils'

interface MobileStatCardsProps {
  stats: DirectoryStats
}

/**
 * Horizontally scrolling stat rail for the mobile home screen. Each tile is a
 * fixed-width card so the row never squashes four metrics into a phone width.
 */
export function MobileStatCards({ stats }: MobileStatCardsProps) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 md:hidden">
      <StatTile
        icon={Users}
        iconWrap="bg-brand-navy-soft"
        iconClass="text-brand-navy"
        value={stats.total}
        label="Total Members"
        sub={
          <>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {stats.active} Active
            </span>
            {' · '}
            {stats.inactive} Inactive
          </>
        }
      />

      <StatTile
        icon={GraduationCap}
        iconWrap="bg-violet-500/10"
        iconClass="text-violet-600 dark:text-violet-400"
        value={stats.trainees}
        label="Trainees"
        sub="Currently Training"
      />

      <StatTile
        icon={Music2}
        iconWrap="bg-sky-500/10"
        iconClass="text-sky-600 dark:text-sky-400"
        label="Voice Distribution"
      >
        {stats.voiceCounts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No voices configured</p>
        ) : (
          <ul className="grid grid-cols-5 gap-1.5">
            {stats.voiceCounts.map((voice) => (
              <li key={voice.id} className="flex flex-col items-center">
                <span className="w-full truncate rounded-md bg-sky-500/10 py-1 text-center text-[0.6875rem] font-semibold text-sky-700 dark:text-sky-300">
                  {voice.shortName}
                </span>
                <span className="mt-1 text-sm font-semibold tabular-nums text-foreground/85">
                  {voice.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </StatTile>

      <StatTile
        icon={ShieldCheck}
        iconWrap="bg-amber-500/10"
        iconClass="text-amber-600 dark:text-amber-400"
        value={stats.withPrivileges}
        label="Special Positions"
        sub="Members with privileges"
      />
    </div>
  )
}

function StatTile({
  icon: Icon,
  iconWrap,
  iconClass,
  value,
  label,
  sub,
  children,
}: {
  icon: typeof Users
  iconWrap: string
  iconClass: string
  value?: number
  label: string
  sub?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 snap-start flex-col gap-2 rounded-xl border border-border/70 bg-card p-3.5',
        value === undefined ? 'w-48' : 'w-40',
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-md',
            iconWrap,
          )}
        >
          <Icon className={cn('size-4', iconClass)} />
        </span>
        <p className="truncate text-[0.75rem] font-medium text-foreground/75">
          {label}
        </p>
      </div>
      {value !== undefined && (
        <span className="text-3xl font-semibold leading-none tracking-tight tabular-nums">
          {value}
        </span>
      )}
      {children}
      {sub && (
        <p className="text-[0.6875rem] leading-snug text-muted-foreground">
          {sub}
        </p>
      )}
    </div>
  )
}
