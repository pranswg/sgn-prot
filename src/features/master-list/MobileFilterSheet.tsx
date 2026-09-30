import { useState } from 'react'
import { Check, Music2, ShieldCheck, Users, Venus, Mars } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  CHOIR_POSITIONS,
  POSITION_LABELS,
} from '@/core/constants/choirPositions'
import type { VoicePosition } from '@/core/types/suguan'
import {
  EMPTY_DIRECTORY_FILTERS,
  countActiveDirectoryFilters,
  toggleInList,
  type DirectoryQuickFilter,
  type DirectoryStats,
  type MemberDirectoryFilters,
} from '@/lib/memberDirectory'

interface MobileFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: MemberDirectoryFilters
  onApply: (filters: MemberDirectoryFilters) => void
  voices: VoicePosition[]
  stats: DirectoryStats
  matchCount: number
}

const QUICK_FILTERS: { value: DirectoryQuickFilter; label: string }[] = [
  { value: 'all', label: 'All Members' },
  { value: 'regular', label: 'Regular' },
  { value: 'provisional', label: 'Trainee / Provisional' },
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

function SheetSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Users
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
      </h3>
      {children}
    </section>
  )
}

function CheckRow({
  label,
  count,
  active,
  onToggle,
}: {
  label: string
  count: number
  active: boolean
  onToggle: () => void
}) {
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={active}
        onClick={onToggle}
        className={cn(
          'flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 text-left text-sm transition-colors',
          active
            ? 'border-brand-teal/40 bg-brand-teal-soft text-brand-teal'
            : 'border-border/70 bg-background text-foreground active:bg-muted',
        )}
      >
        <span
          className={cn(
            'flex size-[1.125rem] shrink-0 items-center justify-center rounded-[0.3125rem] border transition-colors',
            active
              ? 'border-brand-teal bg-brand-teal text-white'
              : 'border-border bg-background',
          )}
        >
          {active && <Check className="size-3" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span
          className={cn(
            'shrink-0 text-xs tabular-nums',
            active ? 'text-brand-teal/80' : 'text-muted-foreground/70',
          )}
        >
          {count}
        </span>
      </button>
    </li>
  )
}

/**
 * Draft-staged filter sheet: edits are local until "Apply Filters" is tapped, so
 * dismissing the sheet never leaves the list in a half-filtered state.
 */
export function MobileFilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
  voices,
  stats,
  matchCount,
}: MobileFilterSheetProps) {
  const [draft, setDraft] = useState(filters)
  const [wasOpen, setWasOpen] = useState(open)

  // Re-seed the draft from the applied filters each time the sheet opens, using
  // the render-phase adjustment pattern so a dismissed sheet never leaks a
  // half-applied filter set.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setDraft(filters)
  }

  const voiceCounts = new Map(
    stats.voiceCounts.map((v) => [v.id, v.count] as const),
  )
  const activeCount = countActiveDirectoryFilters(draft)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88vh] gap-0 overflow-hidden rounded-t-2xl pb-0"
      >
        <SheetHeader className="shrink-0 border-b border-border/70 pb-3">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            {activeCount > 0
              ? `${activeCount} filter${activeCount !== 1 ? 's' : ''} selected`
              : 'Narrow the directory by membership, voice, or choir position.'}
          </SheetDescription>
        </SheetHeader>

        <div className="-mx-4 flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-5">
            <SheetSection icon={Users} title="Membership">
              <ul className="flex flex-col gap-2">
                {QUICK_FILTERS.map((item) => (
                  <CheckRow
                    key={item.value}
                    label={item.label}
                    count={countFor(stats, item.value)}
                    active={draft.quick === item.value}
                    onToggle={() =>
                      setDraft((d) => ({ ...d, quick: item.value }))
                    }
                  />
                ))}
              </ul>
            </SheetSection>

            <SheetSection icon={Venus} title="Gender">
              <ul className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: 'all', label: 'All', icon: Users },
                    { value: 'female', label: "Women's", icon: Venus },
                    { value: 'male', label: "Men's", icon: Mars },
                  ] as const
                ).map((item) => (
                  <li key={item.value}>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          gender:
                            item.value as MemberDirectoryFilters['gender'],
                        }))
                      }
                      className={cn(
                        'flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors',
                        draft.gender === item.value
                          ? 'border-brand-navy bg-brand-navy text-white'
                          : 'border-border/70 bg-background text-foreground active:bg-muted',
                      )}
                    >
                      <item.icon className="size-4" />
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </SheetSection>

            <SheetSection icon={Music2} title="Voice Position">
              <ul className="flex flex-col gap-2">
                {voices.map((voice) => (
                  <CheckRow
                    key={voice.id}
                    label={voice.name}
                    count={voiceCounts.get(voice.id) ?? 0}
                    active={draft.voices.includes(voice.id)}
                    onToggle={() =>
                      setDraft((d) => ({
                        ...d,
                        voices: toggleInList(d.voices, voice.id),
                      }))
                    }
                  />
                ))}
              </ul>
            </SheetSection>

            <SheetSection icon={ShieldCheck} title="Choir Positions">
              <ul className="flex flex-col gap-2">
                {CHOIR_POSITIONS.map((position) => (
                  <CheckRow
                    key={position.id}
                    label={POSITION_LABELS[position.id]}
                    count={stats.positionCounts.get(position.id) ?? 0}
                    active={draft.positions.includes(position.id)}
                    onToggle={() =>
                      setDraft((d) => ({
                        ...d,
                        positions: toggleInList(d.positions, position.id),
                      }))
                    }
                  />
                ))}
              </ul>
            </SheetSection>
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border/70 bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button
            variant="outline"
            className="flex-1"
            disabled={activeCount === 0}
            onClick={() => setDraft(EMPTY_DIRECTORY_FILTERS)}
          >
            Reset
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onApply(draft)
              onOpenChange(false)
            }}
          >
            Apply Filters
            {matchCount > 0 && (
              <span className="text-white/70">({matchCount})</span>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
