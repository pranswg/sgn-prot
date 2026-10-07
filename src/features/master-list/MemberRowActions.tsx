import { Eye, Pencil, Trash2 } from 'lucide-react'
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
  onView: (member: Member) => void
  onEdit: (member: Member) => void
  onDelete: (member: Member) => void
  canEdit?: boolean
  canDelete?: boolean
  sort?: MemberSort
  className?: string
}

export function MemberRowActions({
  member,
  onView,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  sort = 'last-name',
  className,
}: MemberRowActionsProps) {
  const name = formatMemberName(member, sort)

  return (
    <div className={cn('flex items-center justify-end gap-0.5', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`View ${name}`}
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onView(member)}
          >
            <Eye className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View member</TooltipContent>
      </Tooltip>

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
