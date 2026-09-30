import { Check, Music2, ShieldCheck, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CHOIR_POSITIONS, POSITION_LABELS } from '@/core/constants/choirPositions'
import type { VoicePosition } from '@/core/types/suguan'
import type { DirectoryQuickFilter, DirectoryStats } from '@/lib/memberDirectory'

interface DirectoryFilterPanelProps {
  quick: DirectoryQuickFilter
  onQuickChange: (value: DirectoryQuickFilter) => void
  voices: VoicePosition[]
  selectedVoices: string[]
  onVoiceToggle: (voiceId: string) => void
  selectedPositions: string[]
  onPositionToggle: (positionId: string) => void
  stats: DirectoryStats
  positionCounts: Map<string, number>
  className?: string
}

const QUICK_FILTERS: { value: DirectoryQuickFilter; label: string }[] = [
  { value: 'all', label: 'All Members' },
  { value: 'regular', label: 'Regular' },
  { value: 'provisional', label: 'Provisional' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

function countFor(stats: DirectoryStats, value: DirectoryQuickFilter): number {
  switch (value) {
    case 'all':
      return stats.total
    case 'regular':
      return stats.regular
    case 'provisional':
      return stats.provisional
    case 'active':
      return stats.active
    case 'inactive':
      return stats.inactive
  }
}

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: typeof Users
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="size-3.5" />
      <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em]">
        {children}
      </h3>
    </div>
  )
}

function FilterRow({
  label,
  count,
  active,
  onToggle,
  disabled,
  title,
}: {
  label: string
  count: number
  active: boolean
  onToggle: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={active}
        disabled={disabled}
        onClick={onToggle}
        title={title ?? label}
        className={cn(
          'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.8125rem] transition-colors',
          active
            ? 'bg-brand-teal-soft font-medium text-brand-teal'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          disabled && !active && 'opacity-45 hover:bg-transparent',
        )}
      >
        <span
          className={cn(
            'flex size-3.5 shrink-0 items-center justify-center rounded-[0.25rem] border transition-colors',
            active
              ? 'border-brand-teal bg-brand-teal text-white'
              : 'border-border bg-background group-hover:border-brand-teal/50',
          )}
        >
          {active && <Check className="size-2.5" strokeWidth={3} />}
        </span>
        <span className="flex-1 truncate">{label}</span>
        <span
          className={cn(
            'text-[0.6875rem] tabular-nums',
            active ? 'text-brand-teal/80' : 'text-muted-foreground/70',
          )}
        >
          {count}
        </span>
      </button>
    </li>
  )
}

export function DirectoryFilterPanel({
  quick,
  onQuickChange,
  voices,
  selectedVoices,
  onVoiceToggle,
  selectedPositions,
  onPositionToggle,
  stats,
  positionCounts,
  className,
}: DirectoryFilterPanelProps) {
  const voiceCounts = new Map(
    stats.voiceCounts.map((v) => [v.id, v.count] as const),
  )

  return (
    <aside
      className={cn(
        // Sticky so filters stay reachable while the member list scrolls.
        // `top-[4.5rem]` clears the sticky h-14 desktop header; the max-height
        // lets the panel scroll internally on short windows instead of
        // overflowing off-screen.
        'sticky top-[4.5rem] flex max-h-[calc(100vh-6rem)] flex-col gap-5 overflow-y-auto rounded-xl border border-border/70 bg-card p-4 shadow-none [scrollbar-width:thin]',
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <SectionLabel icon={Users}>Membership</SectionLabel>
        <ul className="mt-2 flex flex-col gap-0.5">
          {QUICK_FILTERS.map((item) => {
            const isActive = quick === item.value
            return (
              <li key={item.value}>
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onQuickChange(item.value)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.8125rem] transition-colors',
                    isActive
                      ? 'bg-brand-teal-soft font-medium text-brand-teal'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <span className="flex-1 truncate">{item.label}</span>
                  <span
                    className={cn(
                      'text-[0.6875rem] tabular-nums',
                      isActive
                        ? 'text-brand-teal/80'
                        : 'text-muted-foreground/70',
                    )}
                  >
                    {countFor(stats, item.value)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="h-px w-full bg-border" />

      <div className="flex flex-col gap-1">
        <SectionLabel icon={Music2}>Voice Position</SectionLabel>
        <ul className="mt-2 flex flex-col gap-0.5">
          {voices.map((voice) => {
            const count = voiceCounts.get(voice.id) ?? 0
            return (
              <FilterRow
                key={voice.id}
                label={voice.name}
                count={count}
                active={selectedVoices.includes(voice.id)}
                disabled={count === 0 && !selectedVoices.includes(voice.id)}
                onToggle={() => onVoiceToggle(voice.id)}
              />
            )
          })}
        </ul>
      </div>

      <div className="h-px w-full bg-border" />

      <div className="flex flex-col gap-1">
        <SectionLabel icon={ShieldCheck}>Choir Positions</SectionLabel>
        <ul className="mt-2 flex flex-col gap-0.5">
          {CHOIR_POSITIONS.map((item) => {
            const count = positionCounts.get(item.id) ?? 0
            return (
              <FilterRow
                key={item.id}
                label={POSITION_LABELS[item.id]}
                count={count}
                active={selectedPositions.includes(item.id)}
                disabled={count === 0 && !selectedPositions.includes(item.id)}
                onToggle={() => onPositionToggle(item.id)}
              />
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
