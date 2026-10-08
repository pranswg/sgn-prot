import { useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, GraduationCap, User, X } from 'lucide-react'
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
import {
  voicePositionsForGender,
  UNASSIGNED_VOICE_ID,
} from '@/core/constants/voicePositions'
import type { Trainee, TraineeInput } from '@/core/types/member'
import { useMemberStore } from '@/store/memberStore'
import { useSettingsStore } from '@/store/settingsStore'
import { cn } from '@/lib/utils'
import { isDateKey, toDateKeyFromInstant, todayPHT } from '@/lib/phDate'

interface TraineeFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trainee?: Trainee | null
}

interface FormState {
  firstName: string
  middleName: string
  suffix: string
  lastName: string
  gender: 'male' | 'female'
  voicePosition: string
  trainingStartDate: string
  status: 'active' | 'inactive'
}

function blankForm(): FormState {
  return {
    firstName: '',
    middleName: '',
    suffix: '',
    lastName: '',
    gender: 'female',
    voicePosition: UNASSIGNED_VOICE_ID,
    trainingStartDate: todayPHT(),
    status: 'active',
  }
}

/** A stored `dateAdded` (a PHT instant or a plain date key) back to a date key. */
function storedDateKey(raw: string): string {
  if (!raw) return todayPHT()
  if (isDateKey(raw)) return raw
  const key = toDateKeyFromInstant(raw)
  return isDateKey(key) ? key : todayPHT()
}

/**
 * Native-feeling mobile trainee form: a bottom sheet with a drag handle, a
 * compact header, fields grouped into two collapsible cards, and a sticky
 * action bar above the safe area. Mirrors the Member form sheet.
 */
export function TraineeFormSheet({
  open,
  onOpenChange,
  trainee,
}: TraineeFormSheetProps) {
  const addTrainee = useMemberStore((s) => s.addTrainee)
  const updateTrainee = useMemberStore((s) => s.updateTrainee)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const [form, setForm] = useState<FormState>(blankForm)
  const [wasOpen, setWasOpen] = useState(open)
  const [basicOpen, setBasicOpen] = useState(true)
  const [trainingOpen, setTrainingOpen] = useState(false)

  // Seed the form whenever the sheet opens so it always reflects the trainee
  // being edited (or a blank slate for a new one) rather than the last edit.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setForm(
        trainee
          ? {
              firstName: trainee.firstName,
              middleName: trainee.middleName ?? '',
              suffix: trainee.suffix ?? '',
              lastName: trainee.lastName,
              gender: trainee.gender,
              voicePosition: trainee.voicePosition,
              trainingStartDate: storedDateKey(trainee.dateAdded),
              status: trainee.status === 'active' ? 'active' : 'inactive',
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
        f.voicePosition === UNASSIGNED_VOICE_ID
          ? UNASSIGNED_VOICE_ID
          : options.find((v) => v.id === f.voicePosition)?.id ?? fallback,
    }))
  }

  const handleSave = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Please provide the trainee's full name.")
      return
    }
    if (!form.trainingStartDate) {
      toast.error("Please provide the trainee's training start date.")
      return
    }
    const input: TraineeInput = {
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim() || undefined,
      suffix: form.suffix.trim() || undefined,
      lastName: form.lastName.trim(),
      gender: form.gender,
      voicePosition: form.voicePosition,
      status: form.status,
      dateAdded: form.trainingStartDate,
      ...(trainee?.notes ? { notes: trainee.notes } : {}),
    }
    if (trainee) {
      updateTrainee(trainee.id, input)
      toast.success('Trainee updated.')
    } else {
      addTrainee(input)
      toast.success('Trainee added.')
    }
    onOpenChange(false)
  }

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
              <GraduationCap className="size-5" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-lg font-bold">
                {trainee ? 'Edit Trainee' : 'Add Trainee'}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {trainee
                  ? `Update ${trainee.firstName} ${trainee.lastName}.`
                  : 'Add a new trainee member for choir training.'}
              </SheetDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="shrink-0 rounded-full"
          >
            <X className="size-[18px]" />
          </Button>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto border-t border-border/60 px-4 py-4 pb-6">
          <div className="flex min-w-0 flex-col gap-3">
            <SectionCard
              icon={<User className="size-4" />}
              title="Basic Information"
              open={basicOpen}
              onToggle={() => setBasicOpen((o) => !o)}
            >
              <div className="flex min-w-0 flex-col gap-3">
                <div className="grid w-full grid-cols-2 gap-3">
                  <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor="t-m-first">
                      First Name{' '}
                      <span className="font-normal text-muted-foreground">
                        (Required)
                      </span>
                    </Label>
                    <Input
                      id="t-m-first"
                      value={form.firstName}
                      onChange={(e) => set('firstName', e.target.value)}
                      placeholder="First name"
                      className="h-11 w-full rounded-xl px-3.5"
                    />
                  </div>
                  <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor="t-m-last">
                      Last Name{' '}
                      <span className="font-normal text-muted-foreground">
                        (Required)
                      </span>
                    </Label>
                    <Input
                      id="t-m-last"
                      value={form.lastName}
                      onChange={(e) => set('lastName', e.target.value)}
                      placeholder="Last name"
                      className="h-11 w-full rounded-xl px-3.5"
                    />
                  </div>
                </div>
                <div className="grid w-full grid-cols-2 gap-3">
                  <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor="t-m-middle">
                      Middle Name{' '}
                      <span className="font-normal text-muted-foreground">
                        (Optional)
                      </span>
                    </Label>
                    <Input
                      id="t-m-middle"
                      value={form.middleName}
                      onChange={(e) => set('middleName', e.target.value)}
                      placeholder="Middle name or initial"
                      className="h-11 w-full rounded-xl px-3.5"
                    />
                  </div>
                  <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor="t-m-suffix">
                      Suffix{' '}
                      <span className="font-normal text-muted-foreground">
                        (Optional)
                      </span>
                    </Label>
                    <Input
                      id="t-m-suffix"
                      value={form.suffix}
                      onChange={(e) => set('suffix', e.target.value)}
                      placeholder="e.g. Jr., Sr., III"
                      className="h-11 w-full rounded-xl px-3.5"
                    />
                  </div>
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
                        <SelectItem value={UNASSIGNED_VOICE_ID}>
                          No voice assigned yet
                        </SelectItem>
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
            </SectionCard>

            <SectionCard
              icon={<GraduationCap className="size-4" />}
              title="Training Information"
              open={trainingOpen}
              onToggle={() => setTrainingOpen((o) => !o)}
            >
              <div className="flex min-w-0 flex-col gap-3">
                <div className="grid w-full gap-1.5">
                  <Label htmlFor="t-m-trainingStartDate">
                    Training Start Date
                  </Label>
                  <Input
                    id="t-m-trainingStartDate"
                    type="date"
                    value={form.trainingStartDate}
                    onChange={(e) => set('trainingStartDate', e.target.value)}
                    className="h-11 w-full rounded-xl px-3.5"
                  />
                </div>
                <div className="grid w-full gap-1.5">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => set('status', v as 'active' | 'inactive')}
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Active is currently undergoing training; Inactive is no
                    longer participating.
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-border/70 bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button
            variant="secondary"
            className="h-12 flex-1 rounded-xl text-sm font-semibold"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="h-12 flex-1 rounded-xl text-sm font-semibold"
            onClick={handleSave}
          >
            {trainee ? 'Save Changes' : 'Add Trainee'}
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