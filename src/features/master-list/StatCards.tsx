import type { DirectoryStats } from '@/lib/memberDirectory'
import { cn } from '@/lib/utils'

export type StatAction = 'all' | 'active' | 'inactive' | 'trainees'

interface StatCardsProps {
  stats: DirectoryStats
  /**
   * The action the directory currently reflects, or `null` when it is
   * narrowed by a filter no card owns (voice, position, query).
   */
  selected: StatAction | null
  onSelect: (action: StatAction) => void
}

/**
 * The Master List KPI strip: one bordered row of tap targets rather than four
 * separate cards, so each metric doubles as a shortcut without competing with
 * the toolbar below it. The member counts apply their directory filter, and
 * Trainees jumps to the Trainees tab.
 */
export function StatCards({ stats, selected, onSelect }: StatCardsProps) {
  return (
    <div className="grid grid-cols-4 divide-x divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card">
      <StatTile
        value={stats.total}
        label="Members"
        selected={selected === 'all'}
        onClick={() => onSelect('all')}
      />
      <StatTile
        value={stats.active}
        label="Active"
        selected={selected === 'active'}
        onClick={() => onSelect('active')}
      />
      <StatTile
        value={stats.inactive}
        label="Inactive"
        selected={selected === 'inactive'}
        onClick={() => onSelect('inactive')}
      />
      <StatTile
        value={stats.trainees}
        label="Trainees"
        onClick={() => onSelect('trainees')}
      />
    </div>
  )
}

function StatTile({
  value,
  label,
  selected = false,
  onClick,
}: {
  value: number
  label: string
  selected?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-1 px-1 py-3 text-center transition-colors',
        selected
          ? 'bg-brand-teal-soft text-brand-teal'
          : 'text-foreground hover:bg-muted/60 active:bg-muted',
      )}
    >
      <span className="text-2xl font-semibold leading-none tracking-tight tabular-nums sm:text-[1.75rem]">
        {value}
      </span>
      <span
        className={cn(
          'truncate text-[0.6875rem] font-medium',
          selected ? 'text-brand-teal' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
    </button>
  )
}
