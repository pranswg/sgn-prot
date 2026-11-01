import {
  ArrowUpRight,
  LogOut,
  MoreVertical,
  Pencil,
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
import type { Trainee } from '@/core/types/member'
import { formatMemberName } from '@/lib/memberDirectory'
import { cn } from '@/lib/utils'

interface TraineeRowActionsProps {
  trainee: Trainee
  onPromote: (trainee: Trainee) => void
  onRestore: (trainee: Trainee) => void
  onEdit: (trainee: Trainee) => void
  onTransfer: (trainee: Trainee) => void
  onRemove: (trainee: Trainee) => void
  className?: string
}

/**
 * One kebab per trainee row, matching the Master List's row menu so the last
 * column stays quiet instead of carrying four always-visible icons.
 */
export function TraineeRowActions({
  trainee,
  onPromote,
  onRestore,
  onEdit,
  onTransfer,
  onRemove,
  className,
}: TraineeRowActionsProps) {
  const name = formatMemberName(trainee)
  const transferredOut = trainee.status === 'transferred-out'

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
          {transferredOut ? (
            <DropdownMenuItem onSelect={() => onRestore(trainee)}>
              <Undo2 className="size-4" />
              Restore trainee
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              disabled={trainee.status !== 'active'}
              onSelect={() => onPromote(trainee)}
            >
              <ArrowUpRight className="size-4" />
              Promote trainee
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => onEdit(trainee)}>
            <Pencil className="size-4" />
            Edit trainee
          </DropdownMenuItem>
          {!transferredOut && (
            <DropdownMenuItem onSelect={() => onTransfer(trainee)}>
              <LogOut className="size-4" />
              Transfer out
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => onRemove(trainee)}>
            <Trash2 className="size-4" />
            Remove trainee
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
