import { useState } from 'react'
import { toast } from 'sonner'
import { BadgeCheck, ChevronDown, Music4, User, UserPlus, X } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
  suffix: string
  lastName: string
  gender: 'male' | 'female'
  voicePosition: string
  membershipType: MembershipType
}

function blankForm(): FormState {
  return {
    firstName: '',
    middleName: '',
    suffix: '',
    lastName: '',
    gender: 'female',
    voicePosition: 'soprano-1',
    membershipType: 'regular',
  }
}

/**
 * Native-feeling mobile member form: a bottom sheet with a drag handle, a
 * compact header, fields grouped into three collapsible cards, and a sticky
 * action bar above the safe area. Every grid child is `min-w-0` so long
 * strings cannot push the sheet past the phone screen's edge.
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
  const [personalOpen, setPersonalOpen] = useState(true)
  const [choirOpen, setChoirOpen] = useState(false)
  const [membershipOpen, setMembershipOpen] = useState(false)

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
              suffix: member.suffix ?? '',
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
        suffix: form.suffix.trim() || undefined,
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
        suffix: form.suffix.trim() || undefined,
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

  const close = () => onOpenChange(false)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        overlayClassName="bg-black/30"
        className="flex h-[88dvh] flex-col gap-0 overflow-hidden rounded-t-3xl pb-0 shadow-[0_-8px_32px_rgba(15,23,42,0.25)]"
      >
        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1.5 w-10 rounded-full bg-border/80" />
        </div>

        <div className="flex items-center justify-between gap-3 px-5 pt-2 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <UserPlus className="size-5" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-lg font-bold">
                {member ? 'Edit Member' : 'Add Member'}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {member
                  ? `Update ${member.firstName} ${member.lastName}.`
                  : 'Add a new choir member to the Master List.'}
              </SheetDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Close"
            onClick={close}
            className="shrink-0 rounded-full"
          >
            <X className="size-[18px]" />
          </Button>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto border-t border-border/60 px-4 py-4 pb-6">
          <div className="flex min-w-0 flex-col gap-3">
            <SectionCard
              icon={<User className="size-4" />}
              title="Personal Information"
              open={personalOpen}
              onToggle={() => setPersonalOpen((o) => !o)}
            >
              <div className="flex min-w-0 flex-col gap-3">
                <div className="grid w-full grid-cols-2 gap-3">
                  <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor="m-first">
                      First Name{' '}
                      <span className="font-normal text-muted-foreground">
                        (Required)
                      </span>
                    </Label>
                    <Input
                      id="m-first"
                      value={form.firstName}
                      onChange={(e) => set('firstName', e.target.value)}
                      placeholder="First name"
                      className="h-11 w-full rounded-xl px-3.5"
                    />
                  </div>
                  <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor="m-last">
                      Last Name{' '}
                      <span className="font-normal text-muted-foreground">
                        (Required)
                      </span>
                    </Label>
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
                    <Label htmlFor="m-middle">
                      Middle Name{' '}
                      <span className="font-normal text-muted-foreground">
                        (Optional)
                      </span>
                    </Label>
                    <Input
                      id="m-middle"
                      value={form.middleName}
                      onChange={(e) => set('middleName', e.target.value)}
                      placeholder="Middle name or initial"
                      className="h-11 w-full rounded-xl px-3.5"
                    />
                  </div>
                  <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor="m-suffix">
                      Suffix{' '}
                      <span className="font-normal text-muted-foreground">
                        (Optional)
                      </span>
                    </Label>
                    <Input
                      id="m-suffix"
                      value={form.suffix}
                      onChange={(e) => set('suffix', e.target.value)}
                      placeholder="e.g. Jr., Sr., III"
                      className="h-11 w-full rounded-xl px-3.5"
                    />
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              icon={<Music4 className="size-4" />}
              title="Choir Information"
              open={choirOpen}
              onToggle={() => setChoirOpen((o) => !o)}
            >
              <div className="grid w-full grid-cols-2 gap-3">
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
                <div className="grid min-w-0 gap-1.5">
                  <Label>Voice Position</Label>
                  <Select
                    value={form.voicePosition}
                    onValueChange={(v) => set('voicePosition', v)}
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl">
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
            </SectionCard>

            <SectionCard
              icon={<BadgeCheck className="size-4" />}
              title="Membership"
              open={membershipOpen}
              onToggle={() => setMembershipOpen((o) => !o)}
            >
              <div className="grid w-full gap-1.5">
                <Label>Membership</Label>
                <Select
                  value={form.membershipType}
                  onValueChange={(v) =>
                    set('membershipType', v as MembershipType)
                  }
                >
                  <SelectTrigger className="h-11 w-full rounded-xl">
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
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Organista, Tagapagturo, and Assistant Tagapagturo all count
                  as Organists for the Organist Suguan.
                </p>
              </div>
            </SectionCard>
          </div>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-border/70 bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button
            variant="secondary"
            className="h-12 flex-1 rounded-xl text-sm font-semibold"
            onClick={close}
          >
            Cancel
          </Button>
          <Button
            className="h-12 flex-1 rounded-xl text-sm font-semibold"
            onClick={handleSave}
          >
            {member ? 'Save Changes' : 'Add Member'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SectionCard({
  icon,
  title,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {title}
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && <div className="border-t border-border/60 px-4 py-4">{children}</div>}
    </section>
  )
}