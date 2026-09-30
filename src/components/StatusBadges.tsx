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
          ? 'border-emerald-600/15 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'border-border bg-muted text-muted-foreground',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full',
          active ? 'bg-emerald-500' : 'bg-muted-foreground/50',
        )}
      />
      {active ? 'Active' : 'Inactive'}
    </Badge>
  )
}

const TRAINEE_STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  inactive: 'bg-red-500/15 text-red-700 dark:text-red-300',
  promoted: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
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
          ? 'border-pink-500/20 bg-pink-500/10 text-pink-700 dark:text-pink-300'
          : 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300',
      )}
    >
      {gender === 'female' ? 'Female' : 'Male'}
    </Badge>
  )
}

const VOICE_BADGE_STYLES: Record<string, string> = {
  'soprano-1': 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  'soprano-2': 'border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  alto: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  tenor: 'border-blue-600/20 bg-blue-600/10 text-blue-700 dark:text-blue-300',
  bass: 'border-slate-500/25 bg-slate-500/12 text-slate-700 dark:text-slate-300',
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
  regular: 'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  provisional:
    'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
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
    'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  'pangulong-mang-aawit':
    'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  organista:
    'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  'assistant-tagapagturo':
    'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
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
