import { useState } from 'react'
import { toast } from 'sonner'
import { Check, UserPlus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { voicePositionsForGender } from '@/core/constants/voicePositions'
import { memberPositionLabel } from '@/core/constants/memberMembership'
import type {
  Choir,
  Member,
  MemberInput,
  MembershipType,
} from '@/core/types/member'
import { useMemberStore } from '@/store/memberStore'
import { useSettingsStore } from '@/store/settingsStore'
import { CHOIR_LABELS, membersOf, pnkVoicePositionId } from '@/lib/choirs'
import { cn } from '@/lib/utils'
import { phtInstantISO } from '@/lib/phDate'
import { findPossibleDuplicateMembers } from '@/lib/memberHistory'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { DuplicateMemberPanel } from './DuplicateMemberPanel'
import { MemberInitialsAvatar } from './MemberInitialsAvatar'
import { useDuplicateActions } from './useDuplicateActions'

interface MobileMemberFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: Member | null
  /** The member's M-code, shown beside their name while editing. */
  reference?: string
  /** Choir the new member joins, and the only pool duplicates are checked in. */
  choir?: Choir
  onSaved?: () => void
}

interface FormState {
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

function blankForm(voicePosition = 'soprano-1'): FormState {
  return {
    firstName: '',
    middleName: '',
    suffix: '',
    lastName: '',
    gender: 'female',
    voicePosition,
    membershipType: 'regular',
    isActive: true,
    assignedDutyRoleIds: [],
  }
}

/**
 * Phone member form. It is a centred floating card rather than a bottom sheet,
 * so the fields never sit under the mobile nav bar, with a scrollable body of
 * flat labelled sections and a footer that stays visible while the body scrolls.
 */
export function MobileMemberFormDialog({
  open,
  onOpenChange,
  member,
  reference,
  choir = 'aws',
  onSaved,
}: MobileMemberFormDialogProps) {
  const addMember = useMemberStore((s) => s.addMember)
  const updateMember = useMemberStore((s) => s.updateMember)
  const members = useMemberStore((s) => s.members)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const dutyRoles = useSettingsStore((s) => s.dutyRoles)
  // PNK is a single-voice choir: every member is a Soprano 2, so the form hides
  // the voice picker and saves that configured position instead.
  const isPnk = choir === 'pnk'
  const sopranoVoiceId = pnkVoicePositionId(allVoices())
  const [form, setForm] = useState<FormState>(blankForm)
  const [duplicateCandidates, setDuplicateCandidates] = useState<Member[]>([])
  // "Create New Member Anyway" is a one-shot bypass; it is reset on the next
  // time the dialog opens so a later add still checks for duplicates.
  const [skipDuplicateCheck, setSkipDuplicateCheck] = useState(false)
  const duplicateActions = useDuplicateActions(() => onOpenChange(false))
  const [wasOpen, setWasOpen] = useState(open)

  // Seed the form whenever the dialog opens so it always reflects the member
  // being edited (or a blank slate for a new member) rather than the last edit.
  if (open !== wasOpen) {
    setWasOpen(open)
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
          : blankForm(isPnk ? sopranoVoiceId : undefined),
      )
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleGenderChange = (gender: 'male' | 'female') => {
    const options = voicePositionsForGender(gender, allVoices())
    const fallback = options[0]?.id ?? ''
    setForm((f) => ({
      ...f,
      gender,
      voicePosition: isPnk
        ? sopranoVoiceId
        : (options.find((v) => v.id === f.voicePosition)?.id ?? fallback),
    }))
  }

  const toggleDutyRole = (roleId: string) => {
    set(
      'assignedDutyRoleIds',
      form.assignedDutyRoleIds.includes(roleId)
        ? form.assignedDutyRoleIds.filter((id) => id !== roleId)
        : [...new Set([...form.assignedDutyRoleIds, roleId])],
    )
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
        voicePosition: isPnk ? sopranoVoiceId : form.voicePosition,
        membershipType: form.membershipType,
        assignedDutyRoleIds: form.assignedDutyRoleIds,
        isActive: form.isActive,
      }
      // Legacy positions and notes remain untouched by this editor.
      updateMember(member.id, input)
      toast.success('Member updated.')
    } else {
      const duplicates = findPossibleDuplicateMembers(
        membersOf(members, choir),
        {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
        },
      )
      if (duplicates.length > 0 && !skipDuplicateCheck) {
        setDuplicateCandidates(duplicates)
        return
      }
      const input: MemberInput = {
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim() || undefined,
        suffix: form.suffix.trim() || undefined,
        lastName: form.lastName.trim(),
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
    }
    onOpenChange(false)
    onSaved?.()
  }

  const [saveMember, savingMember] = useAsyncAction(handleSave)

  const close = () => onOpenChange(false)

  const duplicateFocused = duplicateCandidates.length > 0
  const memberMeta = member
    ? [reference ?? null, memberPositionLabel(member, allVoices())]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md">
        <div className="flex shrink-0 items-center gap-3 border-b border-border/60 py-4 pr-12 pl-5">
          {member ? (
            <MemberInitialsAvatar
              member={member}
              sort="last-name"
              className="size-11 shrink-0 text-sm"
            />
          ) : (
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <UserPlus className="size-5" />
            </span>
          )}
          <div className="min-w-0">
            <DialogTitle className="truncate text-base font-bold">
              {duplicateFocused
                ? 'Possible duplicate'
                : member
                  ? 'Edit member'
                  : 'Add member'}
            </DialogTitle>
            <DialogDescription className="truncate text-xs">
              {duplicateFocused
                ? 'A member with this name already exists in the Master List.'
                : member
                  ? memberMeta
                  : `New member in the ${CHOIR_LABELS[choir]} Master List.`}
            </DialogDescription>
          </div>
        </div>

        {duplicateFocused ? (
          <div className="min-w-0 flex-1 overflow-y-auto px-4 py-4 pb-6">
            <DuplicateMemberPanel
              mobile
              candidates={duplicateCandidates}
              onViewHistory={duplicateActions.viewHistory}
              onRestore={duplicateActions.restore}
              onContinue={() => {
                setDuplicateCandidates([])
                setSkipDuplicateCheck(true)
                handleSave()
              }}
              onCancel={() => setDuplicateCandidates([])}
            />
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1 overflow-y-auto px-5 py-5">
              <div className="flex min-w-0 flex-col gap-6">
                <FormSection label="Personal information">
                  <div className="grid w-full grid-cols-2 gap-3">
                    <div className="grid min-w-0 gap-1.5">
                      <Label htmlFor="m-first">First name</Label>
                      <Input
                        id="m-first"
                        value={form.firstName}
                        onChange={(e) => set('firstName', e.target.value)}
                        placeholder="First name"
                        className="h-11 w-full rounded-xl px-3.5"
                      />
                    </div>
                    <div className="grid min-w-0 gap-1.5">
                      <Label htmlFor="m-last">Last name</Label>
                      <Input
                        id="m-last"
                        value={form.lastName}
                        onChange={(e) => set('lastName', e.target.value)}
                        placeholder="Last name"
                        className="h-11 w-full rounded-xl px-3.5"
                      />
                    </div>
                  </div>
                  <div className="grid w-full grid-cols-2 gap-3">
                    <div className="grid min-w-0 gap-1.5">
                      <Label htmlFor="m-middle">Middle name</Label>
                      <Input
                        id="m-middle"
                        value={form.middleName}
                        onChange={(e) => set('middleName', e.target.value)}
                        placeholder="Middle name or initial"
                        className="h-11 w-full rounded-xl px-3.5"
                      />
                    </div>
                    <div className="grid min-w-0 gap-1.5">
                      <Label htmlFor="m-suffix">Suffix</Label>
                      <Input
                        id="m-suffix"
                        value={form.suffix}
                        onChange={(e) => set('suffix', e.target.value)}
                        placeholder="e.g. Jr., Sr., III"
                        className="h-11 w-full rounded-xl px-3.5"
                      />
                    </div>
                  </div>
                </FormSection>

                <FormSection label="Choir details">
                  <div
                    className={cn(
                      'grid w-full gap-3',
                      !isPnk && 'grid-cols-2',
                    )}
                  >
                    <div className="grid min-w-0 gap-1.5">
                      <Label>Gender</Label>
                      <Select
                        value={form.gender}
                        onValueChange={(v) =>
                          handleGenderChange(v as 'male' | 'female')
                        }
                      >
                        <SelectTrigger className="h-11 w-full rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="male">Male</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {!isPnk && (
                      <div className="grid min-w-0 gap-1.5">
                        <Label>Voice position</Label>
                        <Select
                          value={form.voicePosition}
                          onValueChange={(v) => set('voicePosition', v)}
                        >
                          <SelectTrigger className="h-11 w-full rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {voicePositionsForGender(
                              form.gender,
                              allVoices(),
                            ).map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </FormSection>

                <FormSection label="Status">
                  <div
                    role="group"
                    aria-label="Member status"
                    className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/40 p-1"
                  >
                    {(
                      [
                        { value: true, label: 'Active' },
                        { value: false, label: 'Inactive' },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        aria-pressed={form.isActive === option.value}
                        onClick={() => set('isActive', option.value)}
                        className={cn(
                          'h-10 rounded-lg text-sm font-medium transition-colors',
                          form.isActive === option.value
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </FormSection>

                <FormSection label="Choir rankings">
                  <div className="flex flex-wrap gap-2">
                    {dutyRoles.map((role) => {
                      const checked = form.assignedDutyRoleIds.includes(role.id)
                      return (
                        <button
                          key={role.id}
                          type="button"
                          aria-pressed={checked}
                          onClick={() => toggleDutyRole(role.id)}
                          className={cn(
                            'inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm transition-colors',
                            checked
                              ? 'border-primary/40 bg-brand-teal-soft font-medium text-brand-teal'
                              : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          {checked && <Check className="size-4 shrink-0" />}
                          {role.name}
                        </button>
                      )
                    })}
                  </div>
                </FormSection>
              </div>
            </div>

            <div className="flex shrink-0 gap-3 border-t border-border/60 bg-card px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <Button
                variant="secondary"
                className="h-11 flex-1 rounded-xl text-sm font-semibold"
                onClick={close}
              >
                Cancel
              </Button>
              <Button
                className="h-11 flex-1 rounded-xl text-sm font-semibold"
                onClick={saveMember}
                loading={savingMember}
              >
                {member ? 'Save changes' : 'Add member'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function FormSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </h3>
      {children}
    </section>
  )
}
