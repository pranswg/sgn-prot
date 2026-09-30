import { cn } from '@/lib/utils'
import { memberInitials, type MemberSort } from '@/lib/memberDirectory'
import type { Member } from '@/core/types/member'

interface MemberInitialsAvatarProps {
  member: Pick<Member, 'firstName' | 'lastName' | 'isActive'>
  sort?: MemberSort
  className?: string
}

export function MemberInitialsAvatar({
  member,
  sort = 'last-name',
  className,
}: MemberInitialsAvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-9 shrink-0 select-none items-center justify-center rounded-full text-[0.6875rem] font-semibold tracking-tight ring-1 ring-inset',
        member.isActive
          ? 'bg-brand-navy-soft text-brand-navy ring-brand-navy/10'
          : 'bg-muted text-muted-foreground ring-border',
        className,
      )}
    >
      {memberInitials(member, sort)}
    </span>
  )
}
