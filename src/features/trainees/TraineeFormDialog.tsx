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
import {
  voicePositionsForGender,
  UNASSIGNED_VOICE_ID,
} from '@/core/constants/voicePositions'
import { useSettingsStore } from '@/store/settingsStore'
import { phtInstantISO } from '@/lib/phDate'

interface TraineeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trainee?: Trainee | null
}

export function TraineeFormDialog({
  open,
  onOpenChange,
  trainee,
}: TraineeFormDialogProps) {
  const addTrainee = useMemberStore((s) => s.addTrainee)
  const updateTrainee = useMemberStore((s) => s.updateTrainee)
  const allVoices = useSettingsStore((s) => s.allVoices)

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    gender: 'female' as 'male' | 'female',
    voicePosition: 'soprano-1',
    status: 'active' as 'active' | 'inactive',
    notes: '',
  })

  useEffect(() => {
    if (open) {
      setForm(
        trainee
          ? {
              firstName: trainee.firstName,
              lastName: trainee.lastName,
              gender: trainee.gender,
              voicePosition: trainee.voicePosition,
              status: trainee.status === 'active' ? 'active' : 'inactive',
              notes: trainee.notes ?? '',
            }
          : {
              firstName: '',
              lastName: '',
              gender: 'female',
              voicePosition: 'soprano-1',
              status: 'active',
              notes: '',
            },
      )
    }
  }, [open, trainee])

  const handleGenderChange = (gender: 'male' | 'female') => {
    const voices = voicePositionsForGender(gender, allVoices())
    const fallback = voices.length > 0 ? voices[0].id : ''
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
      toast.error('Please provide the trainee\'s full name.')
      return
    }
    const input: TraineeInput = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      gender: form.gender,
      voicePosition: form.voicePosition,
      status: form.status,
      // Matches members: dateAdded is auto-stamped (a PHT instant with time)
      // on add and preserved untouched on edit, never entered by the user.
      dateAdded: trainee ? trainee.dateAdded : phtInstantISO(),
      notes: form.notes.trim() || undefined,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{trainee ? 'Edit Trainee' : 'Add Trainee'}</DialogTitle>
          <DialogDescription>
            Manage a prospective choir member's record.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                placeholder="First name"
              />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                placeholder="Last name"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid min-w-0 gap-2">
              <Label>Gender</Label>
              <Select
                value={form.gender}
                onValueChange={(v) => handleGenderChange(v as 'male' | 'female')}
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start" className="max-w-[min(calc(100vw-3rem),16rem)]">
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid min-w-0 gap-2">
              <Label>Target Voice Position</Label>
              <Select
                value={form.voicePosition}
                onValueChange={(v) => setForm((f) => ({ ...f, voicePosition: v }))}
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start" className="max-w-[min(calc(100vw-3rem),16rem)]">
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
          <div className="grid min-w-0 gap-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, status: v as 'active' | 'inactive' }))
              }
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start" className="max-w-[min(calc(100vw-3rem),16rem)]">
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-w-0 gap-2">
            <Label>Notes</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {trainee ? 'Save Changes' : 'Add Trainee'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}