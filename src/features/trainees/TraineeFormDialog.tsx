import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Check, GraduationCap } from 'lucide-react'
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
import type { Choir, Trainee, TraineeInput } from '@/core/types/member'
import { useMemberStore } from '@/store/memberStore'
import { voicePositionsForGender, UNASSIGNED_VOICE_ID } from '@/core/constants/voicePositions'
import { useSettingsStore } from '@/store/settingsStore'
import { CHOIR_LABELS } from '@/lib/choirs'
import { memberInitials } from '@/lib/memberDirectory'
import { cn } from '@/lib/utils'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import {
  daysBetween,
  formatDateKey,
  isDateKey,
  toDateKeyFromInstant,
  todayPHT,
} from '@/lib/phDate'

interface TraineeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trainee?: Trainee | null
  /** Choir the new trainee joins. */
  choir?: Choir
}

interface TraineeFormState {
  firstName: string
  middleName: string
  suffix: string
  lastName: string
  gender: 'male' | 'female'
  voicePosition: string
  trainingStartDate: string
  status: 'active' | 'inactive'
}

const emptyForm = (): TraineeFormState => ({
  firstName: '',
  middleName: '',
  suffix: '',
  lastName: '',
  gender: 'female',
  voicePosition: UNASSIGNED_VOICE_ID,
  trainingStartDate: todayPHT(),
  status: 'active',
})

/** A stored `dateAdded` (a PHT instant or a plain date key) back to a date key. */
function storedDateKey(raw: string): string {
  if (!raw) return todayPHT()
  if (isDateKey(raw)) return raw
  const key = toDateKeyFromInstant(raw)
  return isDateKey(key) ? key : todayPHT()
}

/** "Day 12" for a start date still in training; the date itself when future. */
function trainingDayLabel(startKey: string): string {
  if (!isDateKey(startKey)) return 'Start date not set'
  const day = daysBetween(startKey, todayPHT()) + 1
  if (day < 1) return 'Starts soon'
  return `Day ${day}`
}

export function TraineeFormDialog({
  open,
  onOpenChange,
  trainee,
  choir = 'aws',
}: TraineeFormDialogProps) {
  const addTrainee = useMemberStore((s) => s.addTrainee)
  const updateTrainee = useMemberStore((s) => s.updateTrainee)
  const allVoices = useSettingsStore((s) => s.allVoices)

  const [form, setForm] = useState<TraineeFormState>(emptyForm)

  useEffect(() => {
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
          : emptyForm(),
      )
    }
  }, [open, trainee])

  const set = <K extends keyof TraineeFormState>(
    field: K,
    value: TraineeFormState[K],
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
      voicePosition:
        f.voicePosition === UNASSIGNED_VOICE_ID
          ? UNASSIGNED_VOICE_ID
          : (voices.find((v) => v.id === f.voicePosition)?.id ?? fallback),
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
      choir,
      // Notes are preserved untouched by this editor; a trainee has no notes UI.
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

  const [saveTrainee, savingTrainee] = useAsyncAction(handleSave)

  const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim()
  const dayLabel = trainingDayLabel(form.trainingStartDate)
  const startLabel = isDateKey(form.trainingStartDate)
    ? formatDateKey(form.trainingStartDate)
    : '—'

  const rail = (
    <>
      <span
        className={cn(
          'grid size-16 shrink-0 place-items-center rounded-2xl text-xl font-bold tracking-tight text-white',
          fullName ? 'bg-brand-teal' : 'bg-brand-teal/70',
        )}
      >
        {fullName ? (
          memberInitials({
            firstName: form.firstName,
            lastName: form.lastName,
          })
        ) : (
          <GraduationCap className="size-6" />
        )}
      </span>
      <p className="mt-3 text-sm font-bold leading-tight text-foreground">
        {fullName || 'New trainee'}
      </p>
      <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
        {form.gender === 'female' ? "Women's Choir" : "Men's Choir"}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="inline-flex h-5 items-center rounded-md bg-brand-teal-soft px-2 text-[0.625rem] font-bold tracking-wide text-brand-teal">
          {CHOIR_LABELS[choir]}
        </span>
        <span className="inline-flex h-5 items-center rounded-md border border-border bg-card px-2 text-[0.625rem] font-semibold text-muted-foreground">
          Nagsasanay
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card p-3">
        <p className="text-[0.5625rem] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">
          Training since
        </p>
        <p className="mt-1 text-sm font-bold text-foreground">{startLabel}</p>
        <div className="mt-2 flex items-center justify-between text-[0.625rem] font-medium text-muted-foreground">
          <span>{dayLabel}</span>
          <span>{form.status === 'active' ? 'In training' : 'Inactive'}</span>
        </div>
      </div>
      <p className="mt-2 text-[0.6875rem] leading-relaxed text-muted-foreground/80">
        Promotion keeps this start date, so the directory never loses the
        training anniversary.
      </p>

      <div className="flex-1" />
      <p className="mt-4 flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
        <Check className="size-3 shrink-0 text-green-600" />
        Appears in Nagsasanay · {CHOIR_LABELS[choir]}
      </p>
    </>
  )

  return (
    <IdentityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<GraduationCap className="size-5" />}
      accent="teal"
      title={trainee ? 'Edit trainee' : 'Add trainee'}
      description={
        trainee
          ? `Editing ${trainee.firstName} ${trainee.lastName}`
          : `New trainee · ${CHOIR_LABELS[choir]} Nagsasanay`
      }
      rail={rail}
      footerNote="Promoted trainees keep their training start date."
      footer={
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
            onClick={saveTrainee}
            loading={savingTrainee}
          >
            {trainee ? 'Save changes' : 'Add trainee'}
          </Button>
        </>
      }
    >
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
              <Label htmlFor="t-firstName">
                First name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="t-firstName"
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                placeholder="First name"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-lastName">
                Last name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="t-lastName"
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                placeholder="Last name"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-middleName">Middle name</Label>
              <Input
                id="t-middleName"
                value={form.middleName}
                onChange={(e) => set('middleName', e.target.value)}
                placeholder="Middle name or initial"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-suffix">Suffix</Label>
              <Input
                id="t-suffix"
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
          </FormSection>

          <FormSection label="Training">
            <div className="grid gap-1.5">
              <Label htmlFor="t-trainingStartDate">Training start date</Label>
              <Input
                id="t-trainingStartDate"
                type="date"
                value={form.trainingStartDate}
                onChange={(e) => set('trainingStartDate', e.target.value)}
              />
              <p className="text-[0.6875rem] text-muted-foreground">
                {dayLabel} in training · defaults to today.
              </p>
            </div>
          </FormSection>
        </div>

        <FormSection label="Status">
          <div
            role="group"
            aria-label="Trainee status"
            className="grid max-w-xs grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-0.5"
          >
            {(
              [
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={form.status === option.value}
                onClick={() => set('status', option.value)}
                className={cn(
                  'h-7 rounded-md text-sm font-medium transition-colors',
                  form.status === option.value
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
