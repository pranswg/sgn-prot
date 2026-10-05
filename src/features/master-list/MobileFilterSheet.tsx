import { useState } from 'react'
import { Activity, Check, Music2, ShieldCheck, Users } from 'lucide-react'
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
  countActiveDirectoryFilters,
  toggleInList,
  type DirectoryStats,
  type MemberDirectoryFilters,
} from '@/lib/memberDirectory'
import {
  MOBILE_FILTER_LABEL,
  MOBILE_FILTER_SECTIONS,
  type MobileFilterSection,
} from './mobileFilters'

interface MobileFilterSheetProps {
  open: boolean
  section: MobileFilterSection
  onOpenChange: (open: boolean) => void
  filters: MemberDirectoryFilters
  onApply: (filters: MemberDirectoryFilters) => void
  voices: VoicePosition[]
  stats: DirectoryStats
  /** Live count for the in-progress edits, not the already-applied filters. */
  previewCount: (filters: MemberDirectoryFilters) => number
}

const STATUS_FILTERS: { value: 'all' | 'active' | 'inactive'; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const SECTION_ICON: Record<MobileFilterSection, typeof Users> = {
  voices: Music2,
  status: Activity,
  roles: ShieldCheck,
}

function countFor(
  stats: DirectoryStats,
  value: 'all' | 'regular' | 'provisional' | 'active' | 'inactive',
): number {
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

/** Selections inside one section, so a sheet's Clear button cannot silently wipe the others. */
function countSection(
  filters: MemberDirectoryFilters,
  section: MobileFilterSection,
): number {
  switch (section) {
    case 'voices':
      return filters.voices.length
    case 'status':
      return filters.status === 'all' ? 0 : 1
    case 'roles':
      return filters.positions.length + (filters.quick === 'regular' ? 1 : 0)
  }
}

function clearSection(
  filters: MemberDirectoryFilters,
  section: MobileFilterSection,
): MemberDirectoryFilters {
  switch (section) {
    case 'voices':
      return { ...filters, voices: [] }
    case 'status':
      return { ...filters, status: 'all' }
    case 'roles':
      return { ...filters, positions: [], quick: 'all' }
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
 * Each mobile filter button opens one focused bottom sheet instead of a single
 * sheet holding the whole filter panel, so the search row stays five short
 * chips rather than a permanently visible column of controls. Edits are draft
 * staged until "Apply Filters" is tapped, so dismissing the sheet never leaves
 * the list in a half-filtered state, and it shows one section when opened from
 * a chip and all of them otherwise.
 */
export function MobileFilterSheet({
  open,
  section,
  onOpenChange,
  filters,
  onApply,
  voices,
  stats,
  previewCount,
}: MobileFilterSheetProps) {
  const [draft, setDraft] = useState(filters)
  const [lastSeed, setLastSeed] = useState(`${open}:${section}`)

  // Re-seed the draft from the applied filters each time the sheet opens, using
  // the render-phase adjustment pattern so a dismissed sheet never leaks a
  // half-applied filter set. The key also covers switching section.
  const seed = `${open}:${section}`
  if (seed !== lastSeed) {
    setLastSeed(seed)
    if (open) setDraft(filters)
  }

  const voiceCounts = new Map(
    stats.voiceCounts.map((v) => [v.id, v.count] as const),
  )
  const activeCount = section
    ? countSection(draft, section)
    : countActiveDirectoryFilters(draft)
  const shown = section ? [section] : MOBILE_FILTER_SECTIONS

  const renderSection = (id: MobileFilterSection) => {
    switch (id) {
      case 'voices':
        return (
          <SheetSection icon={SECTION_ICON.voices} title={MOBILE_FILTER_LABEL.voices}>
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
        )
      case 'status':
        return (
          <SheetSection icon={SECTION_ICON.status} title={MOBILE_FILTER_LABEL.status}>
            <ul className="flex flex-col gap-2">
              {STATUS_FILTERS.map((item) => (
                <CheckRow
                  key={item.value}
                  label={item.label}
                  count={countFor(stats, item.value)}
                  active={draft.status === item.value}
                  onToggle={() => setDraft((d) => ({ ...d, status: item.value }))}
                />
              ))}
            </ul>
          </SheetSection>
        )
      case 'roles':
        return (
          <SheetSection icon={SECTION_ICON.roles} title={MOBILE_FILTER_LABEL.roles}>
            <ul className="flex flex-col gap-2">
              <CheckRow
                label="Regular"
                count={stats.regular}
                active={draft.quick === 'regular'}
                onToggle={() =>
                  setDraft((d) => ({
                    ...d,
                    quick: d.quick === 'regular' ? 'all' : 'regular',
                  }))
                }
              />
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
        )
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88vh] gap-0 overflow-hidden rounded-t-2xl pb-0"
      >
        <SheetHeader className="shrink-0 border-b border-border/70 pb-3">
          <SheetTitle>
            {section ? MOBILE_FILTER_LABEL[section] : 'Filters'}
          </SheetTitle>
          <SheetDescription>
            {activeCount > 0
              ? `${activeCount} filter${activeCount !== 1 ? 's' : ''} selected`
              : 'Narrow the directory by membership, voice, or choir position.'}
          </SheetDescription>
        </SheetHeader>

        <div className="-mx-4 flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-5">{shown.map(renderSection)}</div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border/70 bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button
            variant="outline"
            className="flex-1"
            disabled={activeCount === 0}
            onClick={() =>
              setDraft((d) =>
                section
                  ? clearSection(d, section)
                  : {
                      ...d,
                      query: '',
                      gender: 'all',
                      voices: [],
                      status: 'all',
                      quick: 'all',
                      positions: [],
                    },
              )
            }
          >
            {section ? 'Clear' : 'Reset'}
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onApply(draft)
              onOpenChange(false)
            }}
          >
            Apply Filters
            <span className="text-white/70">({previewCount(draft)})</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
