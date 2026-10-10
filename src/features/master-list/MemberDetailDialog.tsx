import { toast } from 'sonner'
import { LogOut } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { MemberLifecycleBadge } from '@/components/StatusBadges'
import type { Member } from '@/core/types/member'
import { useMemberStore } from '@/store/memberStore'
import { getVoiceName } from '@/core/constants/voicePositions'
import { positionSummary } from '@/core/constants/choirPositions'
import { useSettingsStore } from '@/store/settingsStore'
import {
  MEMBERSHIP_LABELS,
  memberEffectivePositions,
} from '@/core/constants/memberMembership'
import { useAsyncAction } from '@/hooks/useAsyncAction'

interface MemberDetailDialogProps {
  member: Member | null
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onTransfer: (member: Member) => void
  canEdit: boolean
  canTransfer: boolean
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

export function MemberDetailDialog({
  member,
  onOpenChange,
  onEdit,
  onTransfer,
  canEdit,
  canTransfer,
}: MemberDetailDialogProps) {
  const deactivateMember = useMemberStore((s) => s.deactivateMember)
  const reactivateMember = useMemberStore((s) => s.reactivateMember)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const voices = allVoices()

  const handleToggleActive = () => {
    if (!member) return
    if (member.isActive) {
      deactivateMember(member.id)
      toast.info(`${member.firstName} ${member.lastName} deactivated.`)
    } else {
      reactivateMember(member.id)
      toast.success(`${member.firstName} ${member.lastName} reactivated.`)
    }
  }

  const [toggleActive, togglingActive] = useAsyncAction(handleToggleActive)

  if (!member) return null

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {member.firstName} {member.lastName}
          </DialogTitle>
          <DialogDescription>Member information</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <Row label="Gender" value={member.gender[0].toUpperCase() + member.gender.slice(1)} />
          <Row label="Voice Position" value={getVoiceName(member.voicePosition, voices)} />
          <Row label="Membership" value={MEMBERSHIP_LABELS[member.membershipType]} />
          <Row
            label="Roles"
            value={positionSummary(memberEffectivePositions(member))}
          />
        </div>
        <div className="flex items-center justify-between gap-4 py-1">
          <Label className="text-sm font-medium text-muted-foreground">
            Status
          </Label>
          <MemberLifecycleBadge member={member} />
        </div>
        {(canEdit || canTransfer) && <DialogFooter className="flex !justify-between sm:justify-between">
          <div className="flex gap-2">
            {canEdit && (
              <Button
                variant="outline"
                onClick={toggleActive}
                loading={togglingActive}
                className={member.isActive ? 'text-red-600' : 'text-emerald-600'}
              >
                {member.isActive ? 'Deactivate' : 'Reactivate'}
              </Button>
            )}
            {canTransfer && member.isActive && (
              <Button
                variant="outline"
                className="text-amber-700 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-300"
                onClick={() => {
                  onOpenChange(false)
                  onTransfer(member)
                }}
              >
                <LogOut className="size-4" />
                Transfer Out
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {canEdit && (
              <Button
                onClick={() => {
                  onOpenChange(false)
                  onEdit()
                }}
              >
                Edit
              </Button>
            )}
          </div>
        </DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}