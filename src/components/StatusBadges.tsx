import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ChoirPosition, MembershipType } from '@/core/types/member'
import { POSITION_SHORT_LABELS } from '@/core/constants/choirPositions'

const badgeBase =
  'h-5 rounded-md border-transparent px-1.5 text-[0.6875rem] font-medium tracking-tight'

export function MemberStatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        badgeBase,
        'gap-1.5',
        active
          ? 'bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-300'
          : 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full',
          active ? 'bg-green-600' : 'bg-red-600',
        )}
      />
      {active ? 'Active' : 'Inactive'}
    </Badge>
  )
}

const TRAINEE_STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-300',
  inactive: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300',
  promoted:
    'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
}

export function TraineeStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('font-medium capitalize', TRAINEE_STATUS_STYLES[status])}
    >
      {status}
    </Badge>
  )
}

export function GenderBadge({ gender }: { gender: 'male' | 'female' }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        badgeBase,
        gender === 'female'
          ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
          : 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
      )}
    >
      {gender === 'female' ? 'Female' : 'Male'}
    </Badge>
  )
}

const VOICE_BADGE_STYLES: Record<string, string> = {
  'soprano-1': 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  'soprano-2':
    'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300',
  alto: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
  tenor: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
  bass: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
}

export function VoiceBadge({ name }: { name: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        badgeBase,
        VOICE_BADGE_STYLES[
          name.toLowerCase().replace(/[\s-]+/g, '-')
        ] ?? 'border-border bg-muted text-muted-foreground',
      )}
    >
      {name}
    </Badge>
  )
}

const MEMBERSHIP_BADGE_STYLES: Record<MembershipType, string> = {
  regular:
    'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  provisional:
    'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
}

export function MembershipBadge({ type }: { type: MembershipType }) {
  return (
    <Badge
      variant="outline"
      className={cn(badgeBase, MEMBERSHIP_BADGE_STYLES[type])}
    >
      {type === 'regular' ? 'Regular' : 'Provisional'}
    </Badge>
  )
}

const POSITION_BADGE_STYLES: Record<ChoirPosition, string> = {
  oic: 'border-brand-teal/30 bg-brand-teal-soft text-brand-teal',
  'kalihim-ng-mang-aawit':
    'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  'pangulong-mang-aawit':
    'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  organista: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  'assistant-tagapagturo':
    'bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-300',
}

export function PositionBadge({ position }: { position: ChoirPosition }) {
  return (
    <Badge
      variant="outline"
      title={POSITION_SHORT_LABELS[position]}
      className={cn(badgeBase, POSITION_BADGE_STYLES[position])}
    >
      {POSITION_SHORT_LABELS[position]}
    </Badge>
  )
}
