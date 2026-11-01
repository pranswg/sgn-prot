import { ChevronDown, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DutyRole, VoicePosition } from '@/core/types/suguan'
import type { Member } from '@/core/types/member'
import type {
  MemberPage,
  MemberSort,
} from '@/lib/memberDirectory'
import { MobileMemberCard } from './MobileMemberCard'
import { SectionPaginator } from './SectionPaginator'

interface MobileChoirSectionProps {
  title: string
  icon: typeof Users
  iconClass: string
  page: MemberPage<Member>
  collapsed: boolean
  onToggle: () => void
  voices: VoicePosition[]
  dutyRoles: DutyRole[]
  references: Map<string, string>
  sort: MemberSort
  showVoice: boolean
  hasActions: boolean
  onOpenMenu: (member: Member) => void
  onPageChange: (page: number) => void
}

/**
 * One choir's cards on phones. The header carries the count and range so the
 * cards can drop the gender badge, and the section pages on its own — the same
 * rule the desktop table follows.
 */
export function MobileChoirSection({
  title,
  icon: Icon,
  iconClass,
  page,
  collapsed,
  onToggle,
  voices,
  dutyRoles,
  references,
  sort,
  showVoice,
  hasActions,
  onOpenMenu,
  onPageChange,
}: MobileChoirSectionProps) {
  const rangeLabel =
    page.pageCount > 1
      ? `#${page.firstItem}–#${page.lastItem} of #${page.total}`
      : `#1–#${page.total}`

  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={!collapsed}
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg bg-brand-teal-soft/40 px-3 py-2.5 text-left transition-colors active:bg-brand-teal-soft/60',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        )}
      >
        <Icon className={cn('size-3.5 shrink-0', iconClass)} />
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-foreground/75">
          {title}
        </span>
        <span className="rounded border border-border bg-card px-1.5 text-[0.625rem] font-semibold tabular-nums text-muted-foreground">
          {page.total}
        </span>
        <span className="truncate text-[0.625rem] tabular-nums text-muted-foreground/60">
          {rangeLabel}
        </span>
        <ChevronDown
          className={cn(
            'ml-auto size-4 shrink-0 text-muted-foreground transition-transform',
            collapsed && '-rotate-90',
          )}
        />
      </button>

      {collapsed ? null : (
        <>
          <ul className="flex flex-col gap-2">
            {page.items.map((member) => (
              <MobileMemberCard
                key={member.id}
                member={member}
                reference={references.get(member.id)}
                voices={voices}
                dutyRoles={dutyRoles}
                showVoice={showVoice}
                sort={sort}
                onOpenMenu={onOpenMenu}
                hasActions={hasActions}
              />
            ))}
          </ul>

          {page.pageCount > 1 ? (
            <SectionPaginator
              label={title}
              page={page}
              onPageChange={onPageChange}
              className="border-t-0 px-1 py-1"
            />
          ) : null}
        </>
      )}
    </section>
  )
}
