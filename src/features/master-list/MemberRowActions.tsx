import { LogOut, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { formatMemberName, type MemberSort } from '@/lib/memberDirectory'
import type { Member } from '@/core/types/member'

interface MemberRowActionsProps {
  member: Member
  onEdit: (member: Member) => void
  onTransfer: (member: Member) => void
  onDelete: (member: Member) => void
  canEdit?: boolean
  canTransfer?: boolean
  canDelete?: boolean
  sort?: MemberSort
  className?: string
}

export function MemberRowActions({
  member,
  onEdit,
  onTransfer,
  onDelete,
  canEdit = true,
  canTransfer = true,
  canDelete = false,
  sort = 'last-name',
  className,
}: MemberRowActionsProps) {
  const name = formatMemberName(member, sort)

  return (
    <div className={cn('flex items-center justify-end gap-0.5', className)}>
      {canEdit && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${name}`}
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(member)}
            >
              <Pencil className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit member</TooltipContent>
        </Tooltip>
      )}

      {canTransfer && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Transfer out ${name}`}
              className="text-muted-foreground hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-500/15 dark:hover:text-amber-300"
              onClick={() => onTransfer(member)}
            >
              <LogOut className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Transfer out</TooltipContent>
        </Tooltip>
      )}

      {canDelete && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${name}`}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDelete(member)}
            >
              <Trash2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete member</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
