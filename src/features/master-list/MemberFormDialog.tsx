import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Check, UserPlus } from 'lucide-react'
import { IdentityFormDialog } from '@/components/IdentityFormDialog'
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
import { MEMBERSHIP_LABELS } from '@/core/constants/memberMembership'
import { voicePositionsForGender, getVoiceName } from '@/core/constants/voicePositions'
import { resolveMangAawitDutyRole } from '@/core/constants/dutyRoles'
import { useMemberStore } from '@/store/memberStore'
import { CHOIR_LABELS, membersOf, pnkVoiceOptions, pnkVoicePositionId } from '@/lib/choirs'
import { useSettingsStore } from '@/store/settingsStore'
import { phtInstantISO } from '@/lib/phDate'
import { findPossibleDuplicateMembers } from '@/lib/memberHistory'
import { memberInitials } from '@/lib/memberDirectory'
import { cn } from '@/lib/utils'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { DuplicateMemberPanel } from './DuplicateMemberPanel'
import { MemberHistoryEntry } from './MemberHistoryEntry'
import { useDuplicateActions } from './useDuplicateActions'

interface MemberFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  member?: Member | null
  /** Choir the new member joins, and the only pool duplicates are checked in. */
  choir?: Choir
  /** The member's M-code, shown in the identity rail while editing. */
  reference?: string
  /** Reference codes for the choir, so a matched duplicate can name its code. */
  references?: ReadonlyMap<string, string>
  canManageHistory?: boolean
  /** Closes this form and opens the page's restore dialog. */
  onRequestRestore?: (member: Member) => void
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

const emptyForm = (
  voicePosition = 'soprano-1',
  dutyRoleIds: string[] = [],
): MemberFormState => ({
  firstName: '',
  middleName: '',
  suffix: '',
  lastName: '',
  gender: 'female',
  voicePosition,
  membershipType: 'regular',
  isActive: true,
  assignedDutyRoleIds: dutyRoleIds,
})

export function MemberFormDialog({
  open,
  onOpenChange,
  member,
  choir = 'aws',
  reference,
  references,
  canManageHistory = false,
  onRequestRestore,
  onSaved,
}: MemberFormDialogProps) {
  const members = useMemberStore((s) => s.members)
  const addMember = useMemberStore((s) => s.addMember)
  const updateMember = useMemberStore((s) => s.updateMember)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const storedVoices = useSettingsStore((s) => s.voices)
  const dutyRoles = useSettingsStore((s) => s.dutyRoles)
  // PNK offers Soprano 1, Soprano 2 and Alto, resolved from Settings, and a new
  // member starts on the configured Soprano 2.
  const isPnk = choir === 'pnk'
  const pnkVoices = useMemo(
    () => pnkVoiceOptions(storedVoices),
    [storedVoices],
  )
  const pnkDefaultVoiceId = useMemo(
    () => pnkVoicePositionId(storedVoices),
    [storedVoices],
  )
  // A new member starts ranked as a plain Mang-aawit. The configured duty role
  // is matched by name because Settings generates its id.
  const mangAawitRoleId = resolveMangAawitDutyRole(dutyRoles)?.id ?? ''

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
              voicePosition: isPnk
                ? pnkVoices.some((voice) => voice.id === member.voicePosition)
                  ? member.voicePosition
                  : pnkDefaultVoiceId
                : member.voicePosition,
              membershipType: member.membershipType,
              isActive: member.isActive,
              assignedDutyRoleIds: member.assignedDutyRoleIds ?? [],
            }
          : emptyForm(
              isPnk ? pnkDefaultVoiceId : undefined,
              mangAawitRoleId ? [mangAawitRoleId] : [],
            ),
      )
    }
  }, [open, member, isPnk, pnkVoices, pnkDefaultVoiceId, mangAawitRoleId])

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
        ? f.voicePosition
        : (voices.find((v) => v.id === f.voicePosition)?.id ?? fallback),
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
    const firstName = form.firstName.trim()
    const lastName = form.lastName.trim()
    if (member) {
      const input: Partial<MemberInput> = {
        firstName,
        middleName: form.middleName.trim() || undefined,
        suffix: form.suffix.trim() || undefined,
        lastName,
        gender: form.gender,
        voicePosition: form.voicePosition,
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
      voicePosition: form.voicePosition,
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

  // While adding, the history row resolves the name being typed against the
  // existing roster, so a returning singer can be checked before saving.
  const possibleDuplicate =
    member || !form.firstName.trim() || !form.lastName.trim()
      ? null
      : (findPossibleDuplicateMembers(membersOf(members, choir), {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
        })[0] ?? null)
  const historyMember = member ?? possibleDuplicate

  const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim()

  const rail = (
    <>
      <span
        className={cn(
          'grid size-16 shrink-0 place-items-center rounded-2xl text-xl font-bold tracking-tight text-white',
          fullName ? 'bg-brand-navy' : 'bg-brand-navy/70',
        )}
      >
        {fullName ? (
          memberInitials({
            firstName: form.firstName,
            lastName: form.lastName,
          })
        ) : (
          <UserPlus className="size-6" />
        )}
      </span>
      <p className="mt-3 text-sm font-bold leading-tight text-foreground">
        {fullName || 'New member'}
      </p>
      <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
        {form.gender === 'female' ? "Women's Choir" : "Men's Choir"}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="inline-flex h-5 items-center rounded-md bg-primary/10 px-2 text-[0.625rem] font-bold tracking-wide text-primary">
          {CHOIR_LABELS[choir]}
        </span>
        <span className="inline-flex h-5 items-center rounded-md border border-border bg-card px-2 text-[0.625rem] font-semibold text-muted-foreground">
          {MEMBERSHIP_LABELS[form.membershipType]}
        </span>
      </div>

      <div className="my-4 h-px bg-border/70" />
      <dl className="grid gap-2.5">
        <div>
          <dt className="text-[0.5625rem] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">
            Reference
          </dt>
          <dd className="mt-0.5 text-xs font-semibold text-foreground/90">
            {reference ?? 'Assigned on save'}
          </dd>
        </div>
        <div>
          <dt className="text-[0.5625rem] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">
            Voice position
          </dt>
          <dd className="mt-0.5 text-xs font-semibold text-foreground/90">
            {getVoiceName(form.voicePosition, allVoices())}
          </dd>
        </div>
      </dl>
      <div className="my-4 h-px bg-border/70" />

      <MemberHistoryEntry
        member={historyMember}
        reference={
          member ? reference : historyMember
            ? references?.get(historyMember.id)
            : undefined
        }
        canManage={canManageHistory}
        onRequestRestore={onRequestRestore}
      />
      <p className="mt-2 text-[0.6875rem] leading-relaxed text-muted-foreground/80">
        Open the timeline to restore a returning member instead of saving a
        duplicate.
      </p>

      <div className="flex-1" />
      <p className="mt-4 flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
        <Check className="size-3 shrink-0 text-green-600" />
        {member
          ? `Changes save to the ${CHOIR_LABELS[choir]} Master List`
          : `Saved to the ${CHOIR_LABELS[choir]} Master List`}
      </p>
    </>
  )

  return (
    <IdentityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<UserPlus className="size-5" />}
      title={
        duplicateFocused
          ? 'Possible Duplicate'
          : member
            ? 'Edit member'
            : 'Add member'
      }
      description={
        duplicateFocused
          ? 'A member with this name already exists in the Master List.'
          : member
            ? `Editing ${member.firstName} ${member.lastName}`
            : `New record · ${CHOIR_LABELS[choir]} Master List`
      }
      rail={duplicateFocused ? undefined : rail}
      footerNote={
        member
          ? `Changes are saved to the ${CHOIR_LABELS[choir]} Master List.`
          : 'A reference number is assigned when you save.'
      }
      footer={
        duplicateFocused ? undefined : (
          <>
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 sm:flex-none"
              onClick={saveMember}
              loading={savingMember}
            >
              {member ? 'Save changes' : 'Add member'}
            </Button>
          </>
        )
      }
    >
      {duplicateFocused ? (
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
      ) : (
        <div className="flex flex-col gap-6">
          <FormSection
            label="Personal information"
            hint={
              <>
                <span className="text-destructive">*</span> Required
              </>
            }
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="firstName">
                  First name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                  placeholder="First name"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="lastName">
                  Last name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                  placeholder="Last name"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="middleName">Middle name</Label>
                <Input
                  id="middleName"
                  value={form.middleName}
                  onChange={(e) => set('middleName', e.target.value)}
                  placeholder="Middle name or initial"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="suffix">Suffix</Label>
                <Input
                  id="suffix"
                  value={form.suffix}
                  onChange={(e) => set('suffix', e.target.value)}
                  placeholder="e.g. Jr., Sr., III"
                />
              </div>
            </div>
          </FormSection>

          <div className="grid gap-6 md:grid-cols-[1.55fr_1fr] md:items-start">
            <FormSection label="Choir details">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Gender</Label>
                  <Select
                    value={form.gender}
                    onValueChange={(v) =>
                      handleGenderChange(v as 'male' | 'female')
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Voice position</Label>
                  <Select
                    value={form.voicePosition}
                    onValueChange={(v) => set('voicePosition', v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(isPnk
                        ? pnkVoices
                        : voicePositionsForGender(form.gender, allVoices())
                      ).map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </FormSection>

            <FormSection label="Status">
              <div
                role="group"
                aria-label="Member status"
                className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-0.5"
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
                      'h-7 rounded-md text-sm font-medium transition-colors',
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
          </div>

          <FormSection
            label="Choir rankings"
            hint="Optional · drives the directory filter"
          >
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
                      'inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors',
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
      )}
    </IdentityFormDialog>
  )
}

function FormSection({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h3 className="flex items-center justify-between gap-3 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <span>{label}</span>
        {hint ? (
          <span className="text-[0.625rem] font-medium normal-case tracking-normal text-muted-foreground/80">
            {hint}
          </span>
        ) : null}
      </h3>
      {children}
    </section>
  )
}
