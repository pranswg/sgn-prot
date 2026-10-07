import { CalendarPlus, Eye, Pencil, Trash2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { Member } from '@/core/types/member'
import { formatMemberName, type MemberSort } from '@/lib/memberDirectory'
import { cn } from '@/lib/utils'

interface MemberActionSheetProps {
  member: Member | null
  sort?: MemberSort
  onOpenChange: (open: boolean) => void
  onView: (member: Member) => void
  onEdit: (member: Member) => void
  onAssign: (member: Member) => void
  onRemove: (member: Member) => void
  canEdit: boolean
  canAssign: boolean
  canDelete: boolean
}

/** Mobile three-dot menu. Each row is a full-width, thumb-sized tap target. */
export function MemberActionSheet({
  member,
  sort = 'last-name',
  onOpenChange,
  onView,
  onEdit,
  onAssign,
  onRemove,
  canEdit,
  canAssign,
  canDelete,
}: MemberActionSheetProps) {
  const name = member ? formatMemberName(member, sort) : ''

  return (
    <Sheet open={!!member} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="gap-0 rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="pb-3">
          <SheetTitle>Member Actions</SheetTitle>
          <SheetDescription className="truncate">{name}</SheetDescription>
        </SheetHeader>

        {member && (
          <ul className="flex flex-col gap-1 pb-2">
            <ActionRow
              icon={Eye}
              label="View Profile"
              onClick={() => onView(member)}
            />
            {canEdit && (
              <ActionRow
                icon={Pencil}
                label="Edit Member"
                onClick={() => onEdit(member)}
              />
            )}
            {canAssign && (
              <ActionRow
                icon={CalendarPlus}
                label="Create Suguan Assignment"
                onClick={() => onAssign(member)}
              />
            )}
            {canDelete && (
              <ActionRow
                icon={Trash2}
                label="Remove Member"
                destructive
                onClick={() => onRemove(member)}
              />
            )}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  )
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: typeof Eye
  label: string
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-[0.9375rem] font-medium transition-colors active:bg-muted',
          destructive
            ? 'text-destructive'
            : 'text-foreground hover:bg-muted focus:bg-muted',
        )}
      >
        <Icon className="size-4.5 shrink-0" />
        {label}
      </button>
    </li>
  )
}
