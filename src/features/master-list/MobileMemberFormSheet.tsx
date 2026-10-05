import { useState } from 'react'
import { toast } from 'sonner'
import { Check, X } from 'lucide-react'
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
import { CHOIR_POSITIONS } from '@/core/constants/choirPositions'
import { voicePositionsForGender } from '@/core/constants/voicePositions'
import type { ChoirPosition, Member, MemberInput } from '@/core/types/member'
import { useMemberStore } from '@/store/memberStore'
import { useSettingsStore } from '@/store/settingsStore'
import { cn } from '@/lib/utils'
import { todayPHT } from '@/lib/phDate'

interface MobileMemberFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: Member | null
  onSaved?: () => void
}

interface FormState {
  firstName: string
  lastName: string
  gender: 'male' | 'female'
  voicePosition: string
  membershipType: 'regular' | 'provisional'
  isActive: boolean
  dateAdded: string
  positions: ChoirPosition[]
  notes: string
}

function blankForm(): FormState {
  return {
    firstName: '',
    lastName: '',
    gender: 'female',
    voicePosition: 'soprano-1',
    membershipType: 'regular',
    isActive: true,
    dateAdded: todayPHT(),
    positions: [],
    notes: '',
  }
}

/**
 * Mobile-first member form: stacked sections, large touch targets, checkbox
 * cards for choir positions, and a sticky Save bar above the safe area.
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
              lastName: member.lastName,
              gender: member.gender,
              voicePosition: member.voicePosition,
              membershipType: member.membershipType,
              isActive: member.isActive,
              dateAdded: member.dateAdded,
              positions: member.positions ?? [],
              notes: member.notes ?? '',
            }
          : blankForm(),
      )
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const togglePosition = (position: ChoirPosition) =>
    setForm((f) => ({
      ...f,
      positions: f.positions.includes(position)
        ? f.positions.filter((p) => p !== position)
        : [...f.positions, position],
    }))

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
    const input: MemberInput = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      gender: form.gender,
      voicePosition: form.voicePosition,
      membershipType: form.membershipType,
      isActive: form.isActive,
      dateAdded: form.dateAdded || todayPHT(),
      positions: form.positions,
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

        <div className="-mx-4 flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-5">
            <FormSection title="Basic Information">
              <div className="flex flex-col gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="m-first">First Name</Label>
                  <Input
                    id="m-first"
                    value={form.firstName}
                    onChange={(e) => set('firstName', e.target.value)}
                    placeholder="First name"
                    className="h-11"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="m-last">Last Name</Label>
                  <Input
                    id="m-last"
                    value={form.lastName}
                    onChange={(e) => set('lastName', e.target.value)}
                    placeholder="Last name"
                    className="h-11"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
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
                  <div className="grid gap-1.5">
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
              <ul className="flex flex-col gap-2">
                {(
                  [
                    { value: 'regular', label: 'Regular Member' },
                    { value: 'provisional', label: 'Trainee' },
                  ] as const
                ).map((option) => (
                  <li key={option.value}>
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
                          'flex size-[1.125rem] shrink-0 items-center justify-center-full rounded-full border-2',
                          form.membershipType === option.value
                            ? 'border-white bg-white'
                            : 'border-border',
                        )}
                      >
                        {form.membershipType === option.value && (
                          <span className="size-1.5 rounded-full bg-brand-navy" />
                        )}
                      </span>
                      {option.label}
                    </button>
                  </li>
                ))}
              </ul>
            </FormSection>

            <FormSection title="Status">
              <div
                role="radiogroup"
                aria-label="Member status"
                className="grid grid-cols-2 gap-2"
              >
                {(
                  [
                    { value: true, label: 'Active' },
                    { value: false, label: 'Inactive' },
                  ] as const
                ).map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    role="radio"
                    aria-checked={form.isActive === option.value}
                    onClick={() => set('isActive', option.value)}
                    className={cn(
                      'flex min-h-12 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors',
                      form.isActive === option.value
                        ? option.value
                          ? 'border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'border-red-600/40 bg-red-500/10 text-red-700 dark:text-red-300'
                        : 'border-border/70 bg-background text-foreground active:bg-muted',
                    )}
                  >
                    <span
                      className={cn(
                        'size-1.5 rounded-full',
                        option.value ? 'bg-emerald-500' : 'bg-red-500',
                      )}
                    />
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Inactive members cannot be scheduled.
              </p>
            </FormSection>

            <FormSection title="Privileges">
              <ul className="flex flex-col gap-2">
                {CHOIR_POSITIONS.map((position) => {
                  const checked = form.positions.includes(position.id)
                  return (
                    <li key={position.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => togglePosition(position.id)}
                        className={cn(
                          'flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 text-left text-sm transition-colors',
                          checked
                            ? 'border-brand-teal/40 bg-brand-teal-soft text-brand-teal'
                            : 'border-border/70 bg-background active:bg-muted',
                        )}
                      >
                        <span
                          className={cn(
                            'flex size-[1.125rem] shrink-0 items-center justify-center rounded-[0.3125rem] border transition-colors',
                            checked
                              ? 'border-brand-teal bg-brand-teal text-white'
                              : 'border-border bg-background',
                          )}
                        >
                          {checked && (
                            <Check className="size-3" strokeWidth={3} />
                          )}
                        </span>
                        {position.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Positions control which duty roles a member may be assigned in
                the Suguan Builder.
              </p>
            </FormSection>

            <FormSection title="Additional">
              <div className="flex flex-col gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="m-date">Date Added</Label>
                  <Input
                    id="m-date"
                    type="date"
                    value={form.dateAdded}
                    onChange={(e) => set('dateAdded', e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="m-notes">Notes</Label>
                  <Input
                    id="m-notes"
                    value={form.notes}
                    onChange={(e) => set('notes', e.target.value)}
                    placeholder="Optional notes"
                    className="h-11"
                  />
                </div>
              </div>
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
    <section className="flex flex-col gap-2.5">
      <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}
