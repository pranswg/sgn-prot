import type { SuguanStatus } from '@/core/types/suguan'
import { SUGUAN_STATUS_LABELS } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<SuguanStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  completed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  cancelled: 'bg-red-500/15 text-red-700 dark:text-red-300',
}

export function SuguanStatusBadge({ status }: { status: SuguanStatus }) {
  return (
    <Badge variant="outline" className={cn('font-medium', STATUS_STYLES[status])}>
      {SUGUAN_STATUS_LABELS[status]}
    </Badge>
  )
}

export function MemberStatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium',
        active
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
          : 'bg-red-500/15 text-red-700 dark:text-red-300',
      )}
    >
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
        'font-medium capitalize',
        gender === 'female'
          ? 'bg-pink-500/10 text-pink-700 dark:text-pink-300'
          : 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
      )}
    >
      {gender}
    </Badge>
  )
}