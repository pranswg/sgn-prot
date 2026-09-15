import { toast } from 'sonner'
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
import { Separator } from '@/components/ui/separator'
import type { Member } from '@/core/types/member'
import { useMemberStore } from '@/store/memberStore'
import { getVoiceName } from '@/core/constants/voicePositions'
import { positionSummary } from '@/core/constants/choirPositions'
import { useSettingsStore } from '@/store/settingsStore'
import { formatDate } from '@/lib/format'

interface MemberDetailDialogProps {
  member: Member | null
  onOpenChange: (open: boolean) => void
  onEdit: () => void
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
}: MemberDetailDialogProps) {
  const deactivateMember = useMemberStore((s) => s.deactivateMember)
  const reactivateMember = useMemberStore((s) => s.reactivateMember)
  const removeMember = useMemberStore((s) => s.removeMember)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const voices = allVoices()

  if (!member) return null

  const handleToggleActive = () => {
    if (member.isActive) {
      deactivateMember(member.id)
      toast.info(`${member.firstName} ${member.lastName} deactivated.`)
    } else {
      reactivateMember(member.id)
      toast.success(`${member.firstName} ${member.lastName} reactivated.`)
    }
  }

  const handleRemove = () => {
    removeMember(member.id)
    toast.success('Member removed.')
    onOpenChange(false)
  }

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
          <Row
            label="Membership Type"
            value={member.membershipType[0].toUpperCase() + member.membershipType.slice(1)}
          />
          <Row label="Positions / Privileges" value={positionSummary(member.positions)} />
          <Row label="Status" value={member.isActive ? 'Active' : 'Inactive'} />
          <Row label="Date Added" value={formatDate(member.dateAdded)} />
          {member.notes && (
            <>
              <Separator />
              <p className="text-sm text-muted-foreground">{member.notes}</p>
            </>
          )}
        </div>
        <DialogFooter className="flex !justify-between sm:justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleToggleActive}
              className={member.isActive ? 'text-red-600' : 'text-emerald-600'}
            >
              {member.isActive ? 'Deactivate' : 'Reactivate'}
            </Button>
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-600"
              onClick={handleRemove}
            >
              Remove
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                onOpenChange(false)
                onEdit()
              }}
            >
              Edit
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}