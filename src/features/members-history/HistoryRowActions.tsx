import {
  Eye,
  MoreVertical,
  Trash2,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Member } from '@/core/types/member'
import { formatMemberName } from '@/lib/memberDirectory'
import { cn } from '@/lib/utils'

interface HistoryRowActionsProps {
  member: Member
  canRestore: boolean
  canDelete: boolean
  /** Desktop also shows the eye button; phones reach the timeline by tapping. */
  showView?: boolean
  onView: (member: Member) => void
  onRestore: (member: Member) => void
  onDelete: (member: Member) => void
  className?: string
}

export function HistoryRowActions({
  member,
  canRestore,
  canDelete,
  showView = false,
  onView,
  onRestore,
  onDelete,
  className,
}: HistoryRowActionsProps) {
  const name = formatMemberName(member)

  return (
    <div className={cn('flex items-center justify-end gap-1', className)}>
      {showView && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          aria-label={`View history for ${name}`}
          onClick={() => onView(member)}
        >
          <Eye className="size-4" />
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Actions for ${name}`}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {!showView && (
            <DropdownMenuItem onSelect={() => onView(member)}>
              <Eye className="size-4" />
              View history
            </DropdownMenuItem>
          )}
          {canRestore && (
            <DropdownMenuItem onSelect={() => onRestore(member)}>
              <Undo2 className="size-4" />
              Restore member
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => onDelete(member)}
              >
                <Trash2 className="size-4" />
                Delete member
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
