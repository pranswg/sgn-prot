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
import type { Trainee, TraineeInput } from '@/core/types/member'
import { useMemberStore } from '@/store/memberStore'
import { voicePositionsForGender, UNASSIGNED_VOICE_ID } from '@/core/constants/voicePositions'
import { useSettingsStore } from '@/store/settingsStore'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { isDateKey, toDateKeyFromInstant, todayPHT } from '@/lib/phDate'

interface TraineeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trainee?: Trainee | null
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

export function TraineeFormDialog({
  open,
  onOpenChange,
  trainee,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{trainee ? 'Edit Trainee' : 'Add Trainee'}</DialogTitle>
          <DialogDescription>
            {trainee
              ? `Update the information for ${trainee.firstName} ${trainee.lastName}.`
              : 'Add a new trainee member for choir training.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <p className="text-sm font-medium text-foreground">Basic Information</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="t-firstName">
                First Name <span className="text-muted-foreground">(Required)</span>
              </Label>
              <Input
                id="t-firstName"
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                placeholder="First name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="t-lastName">
                Last Name <span className="text-muted-foreground">(Required)</span>
              </Label>
              <Input
                id="t-lastName"
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                placeholder="Last name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="t-middleName">
                Middle Name <span className="text-muted-foreground">(Optional)</span>
              </Label>
              <Input
                id="t-middleName"
                value={form.middleName}
                onChange={(e) => set('middleName', e.target.value)}
                placeholder="Middle name or initial"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="t-suffix">
                Suffix <span className="text-muted-foreground">(Optional)</span>
              </Label>
              <Input
                id="t-suffix"
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
                  <SelectItem value={UNASSIGNED_VOICE_ID}>
                    No voice assigned yet
                  </SelectItem>
                  {voicePositionsForGender(form.gender, allVoices()).map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="mt-1 text-sm font-medium text-foreground">
            Training Information
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="t-trainingStartDate">Training Start Date</Label>
              <Input
                id="t-trainingStartDate"
                type="date"
                value={form.trainingStartDate}
                onChange={(e) => set('trainingStartDate', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set('status', v as 'active' | 'inactive')}
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
                Active is currently undergoing training; Inactive is no longer
                participating.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={saveTrainee} loading={savingTrainee}>
            {trainee ? 'Save Changes' : 'Add Trainee'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}