import { LogOut, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

/**
 * One kebab per row. The individual actions used to be three always-visible
 * icons; folding them into a menu keeps the last column quiet and matches the
 * mobile action sheet.
 */
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
  if (!canEdit && !canTransfer && !canDelete) return null

  return (
    <div className={cn('flex justify-end', className)}>
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
          {canEdit && (
            <DropdownMenuItem onSelect={() => onEdit(member)}>
              <Pencil className="size-4" />
              Edit member
            </DropdownMenuItem>
          )}
          {canTransfer && (
            <DropdownMenuItem onSelect={() => onTransfer(member)}>
              <LogOut className="size-4" />
              Transfer out
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
