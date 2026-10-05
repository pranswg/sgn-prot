import { GraduationCap, UserCheck, Users } from 'lucide-react'
import type { DirectoryStats } from '@/lib/memberDirectory'
import { cn } from '@/lib/utils'

interface MobileStatCardsProps {
  stats: DirectoryStats
}

/**
 * Horizontally scrolling stat rail for the mobile Master List. Each tile is a
 * fixed-width white card so four metrics never squash into a phone width, and
 * the palette stays navy-on-white with a single teal accent rather than a
 * different colour per metric.
 */
export function MobileStatCards({ stats }: MobileStatCardsProps) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 md:hidden">
      <StatTile
        icon={Users}
        value={stats.total}
        label="Total Members"
        sub="In the registry"
      />
      <StatTile
        icon={UserCheck}
        accent
        value={stats.active}
        label="Active Members"
        sub={`${stats.inactive} inactive`}
      />
      <StatTile
        icon={GraduationCap}
        value={stats.trainees}
        label="Trainees"
        sub="In training"
      />
    </div>
  )
}

function StatTile({
  icon: Icon,
  value,
  label,
  sub,
  accent = false,
}: {
  icon: typeof Users
  value: number
  label: string
  sub: string
  accent?: boolean
}) {
  return (
    <div className="flex w-40 shrink-0 snap-start flex-col gap-2 rounded-xl border border-border/60 bg-card p-3.5 shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-md',
            accent ? 'bg-brand-teal-soft text-brand-teal' : 'bg-brand-navy-soft text-brand-navy',
          )}
        >
          <Icon className="size-4" />
        </span>
        <p className="truncate text-[0.75rem] font-medium text-muted-foreground">
          {label}
        </p>
      </div>
      <span className="text-3xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
        {value}
      </span>
      <p className="text-[0.6875rem] leading-snug text-muted-foreground">{sub}</p>
    </div>
  )
}
