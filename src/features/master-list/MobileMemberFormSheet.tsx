import { useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import type { Member, MemberInput, MembershipType } from '@/core/types/member'
import { useMemberStore } from '@/store/memberStore'
import { useSettingsStore } from '@/store/settingsStore'
import { MEMBERSHIP_OPTIONS } from '@/core/constants/memberMembership'
import { cn } from '@/lib/utils'
import { phtInstantISO } from '@/lib/phDate'

interface MobileMemberFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: Member | null
  onSaved?: () => void
}

interface FormState {
  firstName: string
  middleName: string
  lastName: string
  gender: 'male' | 'female'
  voicePosition: string
  membershipType: MembershipType
}

function blankForm(): FormState {
  return {
    firstName: '',
    middleName: '',
    lastName: '',
    gender: 'female',
    voicePosition: 'soprano-1',
    membershipType: 'regular',
  }
}

/**
 * Mobile-first member form: stacked sections, large touch targets, a
 * membership card list, and a sticky Save bar above the safe area. Every grid
 * child is `min-w-0` and full-width so long strings cannot push the sheet past
 * the phone screen's edge.
 */
export function MobileMemberFormSheet({
  open,
  onOpenChange,
  member,
  onSaved,
}: MobileMemberFormSheetProps) {
  const addMember = useMemberStore((s) => s.addMember)
  const updateMember = useMemberStore((s) => s.updateMember)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const [form, setForm] = useState<FormState>(blankForm)
  const [wasOpen, setWasOpen] = useState(open)

  // Seed the form whenever the sheet opens so it always reflects the member
  // being edited (or a blank slate for a new member) rather than the last edit.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setForm(
        member
          ? {
              firstName: member.firstName,
              middleName: member.middleName ?? '',
              lastName: member.lastName,
              gender: member.gender,
              voicePosition: member.voicePosition,
              membershipType: member.membershipType,
            }
          : blankForm(),
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
      voicePosition:
        options.find((v) => v.id === f.voicePosition)?.id ?? fallback,
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
        lastName: form.lastName.trim(),
        gender: form.gender,
        voicePosition: form.voicePosition,
        membershipType: form.membershipType,
      }
      // isActive, positions, and notes are intentionally left untouched: the
      // editor has no UI for them, so editing a member must never clear them.
      updateMember(member.id, input)
      toast.success('Member updated.')
    } else {
      const input: MemberInput = {
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim() || undefined,
        lastName: form.lastName.trim(),
        gender: form.gender,
        voicePosition: form.voicePosition,
        membershipType: form.membershipType,
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-t-2xl pb-0"
      >
        <SheetHeader className="flex-row items-center justify-between gap-3 border-b border-border/70 p-4 pb-3">
          <div className="min-w-0">
            <SheetTitle className="text-sm">
              {member ? 'Edit Member' : 'Add Member'}
            </SheetTitle>
            <SheetDescription className="truncate text-xs">
              {member
                ? `Update ${member.firstName} ${member.lastName}.`
                : 'Add a new choir member.'}
            </SheetDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </Button>
        </SheetHeader>

        <div className="-mx-4 min-w-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="flex min-w-0 flex-col gap-5">
            <FormSection title="Basic Information">
              <div className="flex min-w-0 flex-col gap-3">
                <div className="grid w-full gap-1.5">
                  <Label htmlFor="m-first">First Name</Label>
                  <Input
                    id="m-first"
                    value={form.firstName}
                    onChange={(e) => set('firstName', e.target.value)}
                    placeholder="First name"
                    className="h-11 w-full"
                  />
                </div>
                <div className="grid w-full gap-1.5">
                  <Label htmlFor="m-last">Last Name</Label>
                  <Input
                    id="m-last"
                    value={form.lastName}
                    onChange={(e) => set('lastName', e.target.value)}
                    placeholder="Last name"
                    className="h-11 w-full"
                  />
                </div>
                <div className="grid w-full gap-1.5">
                  <Label htmlFor="m-middle">Middle Name</Label>
                  <Input
                    id="m-middle"
                    value={form.middleName}
                    onChange={(e) => set('middleName', e.target.value)}
                    placeholder="Middle name or initial"
                    className="h-11 w-full"
                  />
                </div>
                <div className="grid w-full grid-cols-2 gap-3">
                  <div className="grid min-w-0 gap-1.5">
                    <Label>Gender</Label>
                    <Select
                      value={form.gender}
                      onValueChange={(v) =>
                        handleGenderChange(v as 'male' | 'female')
                      }
                    >
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid min-w-0 gap-1.5">
                    <Label>Voice Position</Label>
                    <Select
                      value={form.voicePosition}
                      onValueChange={(v) => set('voicePosition', v)}
                    >
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {voicePositionsForGender(form.gender, allVoices()).map(
                          (v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </FormSection>

            <FormSection title="Membership">
              <ul className="flex min-w-0 flex-col gap-2">
                {MEMBERSHIP_OPTIONS.map((option) => (
                  <li key={option.value} className="min-w-0">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={form.membershipType === option.value}
                      onClick={() => set('membershipType', option.value)}
                      className={cn(
                        'flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 text-left text-sm font-medium transition-colors',
                        form.membershipType === option.value
                          ? 'border-brand-navy bg-brand-navy text-white'
                          : 'border-border/70 bg-background active:bg-muted',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-[1.125rem] shrink-0 items-center justify-center rounded-full border-2',
                          form.membershipType === option.value
                            ? 'border-white bg-white'
                            : 'border-border',
                        )}
                      >
                        {form.membershipType === option.value && (
                          <span className="size-1.5 rounded-full bg-brand-navy" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">{option.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Organista, Tagapagturo, and Assistant Tagapagturo all count as
                Organists for the Organist Suguan.
              </p>
            </FormSection>
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border/70 bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave}>
            {member ? 'Save Changes' : 'Save Member'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function FormSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2.5">
      <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}