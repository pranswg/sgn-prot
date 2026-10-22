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
import type {
  Choir,
  Member,
  MemberInput,
  MembershipType,
} from '@/core/types/member'
import { useMemberStore } from '@/store/memberStore'
import { CHOIR_LABELS, membersOf, pnkVoicePositionId } from '@/lib/choirs'
import { voicePositionsForGender } from '@/core/constants/voicePositions'
import { useSettingsStore } from '@/store/settingsStore'
import { phtInstantISO } from '@/lib/phDate'
import { findPossibleDuplicateMembers } from '@/lib/memberHistory'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { DuplicateMemberPanel } from './DuplicateMemberPanel'
import { useDuplicateActions } from './useDuplicateActions'

interface MemberFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  member?: Member | null
  /** Choir the new member joins, and the only pool duplicates are checked in. */
  choir?: Choir
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
  isActive: boolean
  assignedDutyRoleIds: string[]
}

const emptyForm = (voicePosition = 'soprano-1'): MemberFormState => ({
  firstName: '',
  middleName: '',
  suffix: '',
  lastName: '',
  gender: 'female',
  voicePosition,
  membershipType: 'regular',
  isActive: true,
  assignedDutyRoleIds: [],
})

export function MemberFormDialog({
  open,
  onOpenChange,
  member,
  choir = 'aws',
  onSaved,
}: MemberFormDialogProps) {
  const members = useMemberStore((s) => s.members)
  const addMember = useMemberStore((s) => s.addMember)
  const updateMember = useMemberStore((s) => s.updateMember)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const dutyRoles = useSettingsStore((s) => s.dutyRoles)
  // PNK is a single-voice choir: every member is a Soprano 2, so the form hides
  // the voice picker and saves that configured position instead.
  const isPnk = choir === 'pnk'
  const sopranoVoiceId = pnkVoicePositionId(allVoices())

  const [form, setForm] = useState<MemberFormState>(emptyForm)
  const [duplicateCandidates, setDuplicateCandidates] = useState<Member[]>([])
  // "Create New Member Anyway" is a one-shot bypass; it is reset on the next
  // time the dialog opens so a later add still checks for duplicates.
  const [skipDuplicateCheck, setSkipDuplicateCheck] = useState(false)
  const duplicateActions = useDuplicateActions(() => onOpenChange(false))

  useEffect(() => {
    if (open) {
      setDuplicateCandidates([])
      setSkipDuplicateCheck(false)
      setForm(
        member
          ? {
              firstName: member.firstName,
              middleName: member.middleName ?? '',
              suffix: member.suffix ?? '',
              lastName: member.lastName,
              gender: member.gender,
              voicePosition: isPnk ? sopranoVoiceId : member.voicePosition,
              membershipType: member.membershipType,
              isActive: member.isActive,
              assignedDutyRoleIds: member.assignedDutyRoleIds ?? [],
            }
          : emptyForm(isPnk ? sopranoVoiceId : undefined),
      )
    }
  }, [open, member, isPnk, sopranoVoiceId])

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
      voicePosition: isPnk
        ? sopranoVoiceId
        : (voices.find((v) => v.id === f.voicePosition)?.id ?? fallback),
    }))
  }

  const handleSave = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Please provide the member's full name.")
      return
    }
    const firstName = form.firstName.trim()
    const lastName = form.lastName.trim()
    if (member) {
      const input: Partial<MemberInput> = {
        firstName,
        middleName: form.middleName.trim() || undefined,
        suffix: form.suffix.trim() || undefined,
        lastName,
        gender: form.gender,
        voicePosition: isPnk ? sopranoVoiceId : form.voicePosition,
        membershipType: form.membershipType,
        assignedDutyRoleIds: form.assignedDutyRoleIds,
        isActive: form.isActive,
      }
      // Legacy positions and notes remain untouched by this editor.
      updateMember(member.id, input)
      toast.success('Member updated.')
      onOpenChange(false)
      onSaved?.()
      return
    }

    const duplicates = findPossibleDuplicateMembers(
      membersOf(members, choir),
      {
        firstName,
        lastName,
      },
    )
    if (duplicates.length > 0 && !skipDuplicateCheck) {
      setDuplicateCandidates(duplicates)
      return
    }
    const input: MemberInput = {
      firstName,
      middleName: form.middleName.trim() || undefined,
      suffix: form.suffix.trim() || undefined,
      lastName,
      gender: form.gender,
      voicePosition: isPnk ? sopranoVoiceId : form.voicePosition,
      membershipType: form.membershipType,
      assignedDutyRoleIds: form.assignedDutyRoleIds,
      isActive: form.isActive,
      dateAdded: phtInstantISO(),
      choir,
    }
    addMember(input)
    toast.success('Member added.')
    onOpenChange(false)
    onSaved?.()
  }

  const [saveMember, savingMember] = useAsyncAction(handleSave)

  const duplicateFocused = duplicateCandidates.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {duplicateFocused
              ? 'Possible Duplicate'
              : member
                ? 'Edit Member'
                : 'Add Member'}
          </DialogTitle>
          <DialogDescription>
            {duplicateFocused
              ? 'A member with this name already exists in the Master List.'
              : member
                ? `Update the information for ${member.firstName} ${member.lastName}.`
                : `Add a new member to the ${CHOIR_LABELS[choir]} Master List.`}
          </DialogDescription>
        </DialogHeader>
        {duplicateFocused ? (
          <div className="py-2">
            <DuplicateMemberPanel
              candidates={duplicateCandidates}
              onViewHistory={duplicateActions.viewHistory}
              onRestore={duplicateActions.restore}
              onContinue={() => {
                // Bypass the check once: the user already confirmed they want a
                // separate record. The form data is untouched, so nothing is lost.
                setDuplicateCandidates([])
                setSkipDuplicateCheck(true)
                handleSave()
              }}
              onCancel={() => setDuplicateCandidates([])}
            />
          </div>
        ) : (
          <>
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

          <div className={cn('grid gap-3', !isPnk && 'grid-cols-2')}>
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
            {!isPnk && (
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
            )}
          </div>

          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              value={form.isActive ? 'active' : 'inactive'}
              onValueChange={(v) => set('isActive', v === 'active')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Inactive keeps the member on the Master List with an Inactive
              badge; a transfer out moves them to Members History.
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
          <Button onClick={saveMember} loading={savingMember}>{member ? 'Save Changes' : 'Add Member'}</Button>
        </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}