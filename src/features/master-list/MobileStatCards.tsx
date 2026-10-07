import { GraduationCap, UserCheck, UserMinus, Users } from 'lucide-react'
import type { DirectoryStats } from '@/lib/memberDirectory'
import { cn } from '@/lib/utils'

export type MobileStatAction = 'all' | 'active' | 'inactive' | 'trainees'

interface MobileStatCardsProps {
  stats: DirectoryStats
  /**
   * The action the directory currently reflects, or `null` when it is
   * narrowed by a filter no card owns (voice, position, query).
   */
  selected: MobileStatAction | null
  onSelect: (action: MobileStatAction) => void
}

/**
 * The mobile Master List KPI block: a 2x2 grid of tap targets rather than a
 * scrolling rail, so each metric doubles as a shortcut. The member counts
 * apply their directory filter, and Trainees jumps to the Trainees tab.
 */
export function MobileStatCards({
  stats,
  selected,
  onSelect,
}: MobileStatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:hidden">
      <StatTile
        icon={Users}
        value={stats.total}
        label="Total Members"
        sub="In the registry"
        selected={selected === 'all'}
        onClick={() => onSelect('all')}
      />
      <StatTile
        icon={GraduationCap}
        value={stats.trainees}
        label="Trainees"
        sub="In training"
        onClick={() => onSelect('trainees')}
      />
      <StatTile
        icon={UserCheck}
        value={stats.active}
        label="Active Members"
        sub="Can be scheduled"
        selected={selected === 'active'}
        onClick={() => onSelect('active')}
      />
      <StatTile
        icon={UserMinus}
        value={stats.inactive}
        label="Inactive"
        sub="Not scheduled"
        selected={selected === 'inactive'}
        onClick={() => onSelect('inactive')}
      />
    </div>
  )
}

function StatTile({
  icon: Icon,
  value,
  label,
  sub,
  selected = false,
  onClick,
}: {
  icon: typeof Users
  value: number
  label: string
  sub: string
  selected?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'flex flex-col gap-2 rounded-xl border bg-card p-3.5 text-left shadow-sm transition-colors active:bg-brand-teal-soft/40',
        selected
          ? 'border-brand-teal bg-brand-teal-soft/50 ring-2 ring-brand-teal'
          : 'border-border/60',
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-md',
            selected
              ? 'bg-brand-teal text-white'
              : 'bg-brand-navy-soft text-brand-navy',
          )}
        >
          <Icon className="size-4" />
        </span>
        <p
          className={cn(
            'truncate text-[0.75rem] font-medium',
            selected ? 'text-brand-teal' : 'text-muted-foreground',
          )}
        >
          {label}
        </p>
      </div>
      <span className="text-3xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
        {value}
      </span>
      <p className="text-[0.6875rem] leading-snug text-muted-foreground">
        {sub}
      </p>
    </button>
  )
}
