import { useEffect, useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { Member, MemberInput } from '@/core/types/member'
import { useMemberStore } from '@/store/memberStore'
import { voicePositionsForGender } from '@/core/constants/voicePositions'
import { useSettingsStore } from '@/store/settingsStore'

interface MemberFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  member?: Member | null
  onSaved?: () => void
}

export function MemberFormDialog({
  open,
  onOpenChange,
  member,
  onSaved,
}: MemberFormDialogProps) {
  const addMember = useMemberStore((s) => s.addMember)
  const updateMember = useMemberStore((s) => s.updateMember)
  const allVoices = useSettingsStore((s) => s.allVoices)

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    gender: 'female' as 'male' | 'female',
    voicePosition: 'soprano-1',
    membershipType: 'regular' as 'regular' | 'provisional',
    isActive: true,
    dateAdded: new Date().toISOString().slice(0, 10),
    notes: '',
  })

  useEffect(() => {
    if (open) {
      setForm(
        member
          ? {
              firstName: member.firstName,
              lastName: member.lastName,
              gender: member.gender,
              voicePosition: member.voicePosition,
              membershipType: member.membershipType,
              isActive: member.isActive,
              dateAdded: member.dateAdded,
              notes: member.notes ?? '',
            }
          : {
              firstName: '',
              lastName: '',
              gender: 'female',
              voicePosition: 'soprano-1',
              membershipType: 'regular',
              isActive: true,
              dateAdded: new Date().toISOString().slice(0, 10),
              notes: '',
            },
      )
    }
  }, [open, member])

  const set = (field: string, value: string | boolean) => {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const handleGenderChange = (gender: 'male' | 'female') => {
    const voices = voicePositionsForGender(gender, allVoices())
    setForm((f) => ({
      ...f,
      gender,
      voicePosition:
        voices.find((v) => v.id === f.voicePosition)?.id ?? voices[0].id,
    }))
  }

  const handleSave = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('Please provide the member\'s full name.')
      return
    }
    const input: MemberInput = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      gender: form.gender,
      voicePosition: form.voicePosition,
      membershipType: form.membershipType,
      isActive: form.isActive,
      dateAdded: form.dateAdded || new Date().toISOString().slice(0, 10),
      notes: form.notes.trim() || undefined,
    }
    if (member) {
      updateMember(member.id, input)
      toast.success('Member updated.')
    } else {
      addMember(input)
      toast.success('Member added.')
    }
    onOpenChange(false)
    onSaved?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{member ? 'Edit Member' : 'Add Member'}</DialogTitle>
          <DialogDescription>
            {member
              ? `Update the information for ${member.firstName} ${member.lastName}.`
              : 'Add a new choir member to the Master List.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                placeholder="First name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                placeholder="Last name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Gender</Label>
              <Select
                value={form.gender}
                onValueChange={(v) => handleGenderChange(v as 'male' | 'female')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Voice Position</Label>
              <Select
                value={form.voicePosition}
                onValueChange={(v) => set('voicePosition', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {voicePositionsForGender(form.gender, allVoices()).map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Membership Type</Label>
              <Select
                value={form.membershipType}
                onValueChange={(v) => set('membershipType', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="provisional">Provisional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dateAdded">Date Added</Label>
              <Input
                id="dateAdded"
                type="date"
                value={form.dateAdded}
                onChange={(e) => set('dateAdded', e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Optional notes"
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm font-medium">Active member</Label>
              <p className="text-xs text-muted-foreground">
                Inactive members cannot be scheduled for Suguan.
              </p>
            </div>
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => set('isActive', v)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>{member ? 'Save Changes' : 'Add Member'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}