import { useState } from 'react'
import {
  Check,
  Music2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DutyRole, VoicePosition } from '@/core/types/suguan'
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

interface MobileFilterDialogProps {
  open: boolean
  section: MobileFilterSection
  onOpenChange: (open: boolean) => void
  filters: MemberDirectoryFilters
  onApply: (filters: MemberDirectoryFilters) => void
  voices: VoicePosition[]
  /** Configured duty roles, which are the directory's choir positions. */
  dutyRoles: DutyRole[]
  stats: DirectoryStats
  /** Chips this directory offers, in order. PNK omits `voices`. */
  sections?: MobileFilterSection[]
  /** Live count for the in-progress edits, not the already-applied filters. */
  previewCount: (filters: MemberDirectoryFilters) => number
}

const SECTION_ICON: Record<MobileFilterSection, typeof Users> = {
  voices: Music2,
  roles: ShieldCheck,
}

/** Selections inside one section, so a dialog's Clear button cannot silently wipe the others. */
function countSection(
  filters: MemberDirectoryFilters,
  section: MobileFilterSection,
): number {
  switch (section) {
    case 'voices':
      return filters.voices.length
    case 'roles':
      return filters.positions.length
  }
}

function clearSection(
  filters: MemberDirectoryFilters,
  section: MobileFilterSection,
): MemberDirectoryFilters {
  switch (section) {
    case 'voices':
      return { ...filters, voices: [] }
    case 'roles':
      return { ...filters, positions: [], quick: 'all' }
  }
}

function FilterSection({
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
          'pressable flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 text-left text-sm motion-reduce:transform-none',
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
 * Each mobile filter chip opens one focused floating dialog instead of a bottom
 * sheet, so the panel never sits under the mobile nav bar. Edits are draft
 * staged until "Apply Filters" is tapped, so dismissing the dialog never leaves
 * the list in a half-filtered state.
 */
export function MobileFilterDialog({
  open,
  section,
  onOpenChange,
  filters,
  onApply,
  voices,
  dutyRoles,
  stats,
  sections = MOBILE_FILTER_SECTIONS,
  previewCount,
}: MobileFilterDialogProps) {
  const [draft, setDraft] = useState(filters)
  const [lastSeed, setLastSeed] = useState(`${open}:${section}`)

  // Re-seed the draft from the applied filters each time the dialog opens,
  // using the render-phase adjustment pattern so a dismissed dialog never
  // leaks a half-applied filter set. The key also covers switching section.
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
  const shown = section ? [section] : sections
  const HeaderIcon = section ? SECTION_ICON[section] : SlidersHorizontal

  const renderOptions = (id: MobileFilterSection) => {
    switch (id) {
      case 'voices':
        return (
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
        )
      case 'roles':
        return (
          <ul className="flex flex-col gap-2">
            {dutyRoles.map((role) => (
              <CheckRow
                key={role.id}
                label={role.name}
                count={stats.positionCounts.get(role.id) ?? 0}
                active={draft.positions.includes(role.id)}
                onToggle={() =>
                  setDraft((d) => ({
                    ...d,
                    positions: toggleInList(d.positions, role.id),
                  }))
                }
              />
            ))}
          </ul>
        )
    }
  }

  const renderSection = (id: MobileFilterSection) => (
    <FilterSection icon={SECTION_ICON[id]} title={MOBILE_FILTER_LABEL[id]}>
      {renderOptions(id)}
    </FilterSection>
  )

  const summary =
    activeCount > 0
      ? `${activeCount} filter${activeCount !== 1 ? 's' : ''} selected`
      : section
        ? 'None selected'
        : 'No filters selected'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-sm">
        <div className="flex shrink-0 items-center gap-3 border-b border-border/60 py-4 pr-12 pl-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <HeaderIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="truncate text-base font-bold">
              {section ? MOBILE_FILTER_LABEL[section] : 'Filters'}
            </DialogTitle>
            <DialogDescription className="truncate text-xs">
              {summary}
            </DialogDescription>
          </div>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-5">
            {section ? renderOptions(section) : shown.map(renderSection)}
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border/60 bg-card px-4 py-3">
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
      </DialogContent>
    </Dialog>
  )
}
