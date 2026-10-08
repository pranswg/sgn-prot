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
import type { Member, MemberInput, MembershipType } from '@/core/types/member'
import { useMemberStore } from '@/store/memberStore'
import { voicePositionsForGender } from '@/core/constants/voicePositions'
import { useSettingsStore } from '@/store/settingsStore'
import { MEMBERSHIP_OPTIONS } from '@/core/constants/memberMembership'
import { phtInstantISO } from '@/lib/phDate'
import { Checkbox } from '@/components/ui/checkbox'

interface MemberFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  member?: Member | null
  onSaved?: () => void
}

interface MemberFormState {
  firstName: string
  middleName: string
  suffix: string
  lastName: string
  gender: 'male' | 'female'
  voicePosition: string
  membershipType: MembershipType
  assignedDutyRoleIds: string[]
}

const emptyForm = (): MemberFormState => ({
  firstName: '',
  middleName: '',
  suffix: '',
  lastName: '',
  gender: 'female',
  voicePosition: 'soprano-1',
  membershipType: 'regular',
  assignedDutyRoleIds: [],
})

export function MemberFormDialog({
  open,
  onOpenChange,
  member,
  onSaved,
}: MemberFormDialogProps) {
  const addMember = useMemberStore((s) => s.addMember)
  const updateMember = useMemberStore((s) => s.updateMember)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const dutyRoles = useSettingsStore((s) => s.dutyRoles)

  const [form, setForm] = useState<MemberFormState>(emptyForm)

  useEffect(() => {
    if (open) {
      setForm(
        member
          ? {
              firstName: member.firstName,
              middleName: member.middleName ?? '',
              suffix: member.suffix ?? '',
              lastName: member.lastName,
              gender: member.gender,
              voicePosition: member.voicePosition,
              membershipType: member.membershipType,
              assignedDutyRoleIds: member.assignedDutyRoleIds ?? [],
            }
          : emptyForm(),
      )
    }
  }, [open, member])

  const set = <K extends keyof MemberFormState>(
    field: K,
    value: MemberFormState[K],
  ) => {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const handleGenderChange = (gender: 'male' | 'female') => {
    const voices = voicePositionsForGender(gender, allVoices())
    const fallback = voices.length > 0 ? voices[0].id : ''
    set('gender', gender)
    setForm((f) => ({
      ...f,
      gender,
      voicePosition: voices.find((v) => v.id === f.voicePosition)?.id ?? fallback,
    }))
  }

  const handleSave = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Please provide the member's full name.")
      return
    }
    if (member) {
      const input: Partial<MemberInput> = {
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim() || undefined,
        suffix: form.suffix.trim() || undefined,
        lastName: form.lastName.trim(),
        gender: form.gender,
        voicePosition: form.voicePosition,
        membershipType: form.membershipType,
        assignedDutyRoleIds: form.assignedDutyRoleIds,
      }
      // isActive, legacy positions, and notes remain untouched by this editor.
      updateMember(member.id, input)
      toast.success('Member updated.')
    } else {
      const input: MemberInput = {
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim() || undefined,
        suffix: form.suffix.trim() || undefined,
        lastName: form.lastName.trim(),
        gender: form.gender,
        voicePosition: form.voicePosition,
        membershipType: form.membershipType,
        assignedDutyRoleIds: form.assignedDutyRoleIds,
        isActive: true,
        dateAdded: phtInstantISO(),
      }
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
              <Label htmlFor="firstName">
                First Name <span className="text-muted-foreground">(Required)</span>
              </Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                placeholder="First name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">
                Last Name <span className="text-muted-foreground">(Required)</span>
              </Label>
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
              <Label htmlFor="middleName">
                Middle Name <span className="text-muted-foreground">(Optional)</span>
              </Label>
              <Input
                id="middleName"
                value={form.middleName}
                onChange={(e) => set('middleName', e.target.value)}
                placeholder="Middle name or initial"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="suffix">
                Suffix <span className="text-muted-foreground">(Optional)</span>
              </Label>
              <Input
                id="suffix"
                value={form.suffix}
                onChange={(e) => set('suffix', e.target.value)}
                placeholder="e.g. Jr., Sr., III"
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

          <div className="grid gap-2">
            <Label>Membership</Label>
            <Select
              value={form.membershipType}
              onValueChange={(v) => set('membershipType', v as MembershipType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEMBERSHIP_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Organista, Tagapagturo, and Assistant Tagapagturo all count as
              Organists for the Organist Suguan.
            </p>
          </div>

          <fieldset className="grid gap-3">
            <legend className="text-sm font-medium">Choir Rankings</legend>
            <p className="text-xs text-muted-foreground">
              Select any configured duty-role rankings held by this member.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {dutyRoles.map((role) => (
                <label
                  key={role.id}
                  className="flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={form.assignedDutyRoleIds.includes(role.id)}
                    onCheckedChange={(checked) =>
                      set(
                        'assignedDutyRoleIds',
                        checked
                          ? [...new Set([...form.assignedDutyRoleIds, role.id])]
                          : form.assignedDutyRoleIds.filter(
                              (id) => id !== role.id,
                            ),
                      )
                    }
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </fieldset>
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