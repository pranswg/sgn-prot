import { useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Check,
  Download,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useMemberStore } from '@/store/memberStore'
import { useSuguanStore } from '@/store/suguanStore'
import { useSettingsStore } from '@/store/settingsStore'

interface BackupFile {
  app: string
  version: number
  exportedAt: string
  members: unknown[]
  trainees: unknown[]
  suguan: unknown[]
  serviceTypes: unknown[]
  dutyRoles: unknown[]
  voices: unknown[]
}

export function SettingsPage() {
  const memberStore = useMemberStore()
  const suguanStore = useSuguanStore()
  const settingsStore = useSettingsStore()

  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [serviceName, setServiceName] = useState('')
  const [dutyName, setDutyName] = useState('')
  const [dutyAbbr, setDutyAbbr] = useState('')
  const [voiceName, setVoiceName] = useState('')
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female')

  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [editServiceName, setEditServiceName] = useState('')
  const [editingDutyId, setEditingDutyId] = useState<string | null>(null)
  const [editDutyName, setEditDutyName] = useState('')
  const [editDutyAbbr, setEditDutyAbbr] = useState('')
  const [editingVoiceId, setEditingVoiceId] = useState<string | null>(null)
  const [editVoiceName, setEditVoiceName] = useState('')
  const [editVoiceGender, setEditVoiceGender] = useState<'male' | 'female'>('female')

  const serviceTypes = settingsStore.allServiceTypes()
  const dutyRoles = settingsStore.allDutyRoles()
  const voices = settingsStore.allVoices()

  const startEditService = (id: string, name: string) => {
    setEditingServiceId(id)
    setEditServiceName(name)
  }

  const saveEditService = () => {
    if (!editingServiceId || !editServiceName.trim()) return
    settingsStore.updateServiceType(editingServiceId, {
      name: editServiceName.trim(),
    })
    setEditingServiceId(null)
    toast.success('Service type updated.')
  }

  const startEditDuty = (id: string, name: string, abbreviation: string) => {
    setEditingDutyId(id)
    setEditDutyName(name)
    setEditDutyAbbr(abbreviation)
  }

  const saveEditDuty = () => {
    if (!editingDutyId || !editDutyName.trim()) return
    settingsStore.updateDutyRole(editingDutyId, {
      name: editDutyName.trim(),
      abbreviation: editDutyAbbr.trim() || editDutyName.trim().slice(0, 3).toUpperCase(),
    })
    setEditingDutyId(null)
    toast.success('Duty role updated.')
  }

  const startEditVoice = (
    id: string,
    name: string,
    gender: 'male' | 'female',
  ) => {
    setEditingVoiceId(id)
    setEditVoiceName(name)
    setEditVoiceGender(gender)
  }

  const saveEditVoice = () => {
    if (!editingVoiceId || !editVoiceName.trim()) return
    settingsStore.updateVoice(editingVoiceId, {
      name: editVoiceName.trim(),
      gender: editVoiceGender,
    })
    setEditingVoiceId(null)
    toast.success('Voice position updated.')
  }

  const handleExport = () => {
    const backup: BackupFile = {
      app: 'inc-choir-manager',
      version: 2,
      exportedAt: new Date().toISOString(),
      members: memberStore.members,
      trainees: memberStore.trainees,
      suguan: suguanStore.suguan,
      serviceTypes: settingsStore.serviceTypes,
      dutyRoles: settingsStore.dutyRoles,
      voices: settingsStore.voices,
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `inc-choir-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Backup exported.')
  }

  const handleImportFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as BackupFile
        if (data.app !== 'inc-choir-manager') {
          toast.error('Not a valid choir manager backup file.')
          return
        }
        memberStore.importData(
          data.members as never,
          data.trainees as never,
        )
        suguanStore.importData(data.suguan as never)
        settingsStore.importData(
          data.serviceTypes as never,
          data.dutyRoles as never,
          data.voices as never,
        )
        toast.success('Backup imported successfully.')
      } catch {
        toast.error('Could not read this file. Please select a JSON backup.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Settings" description="System configuration and data management." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Service Types</CardTitle>
            <CardDescription>
              The schedule of services the choir fulfills. Rename or remove any
              entry, including the standard ones.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-1 rounded-md border p-3 text-sm">
              {serviceTypes.length === 0 && (
                <p className="text-muted-foreground">No service types yet.</p>
              )}
              {serviceTypes.map((t) =>
                editingServiceId === t.id ? (
                  <div key={t.id} className="flex items-center gap-2 rounded px-1 py-0.5">
                    <Input
                      value={editServiceName}
                      onChange={(e) => setEditServiceName(e.target.value)}
                      className="h-8 flex-1"
                    />
                    <Button size="icon-sm" onClick={saveEditService}>
                      <Check className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditingServiceId(null)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded px-2 py-1 hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1">
                      {t.name}
                      {!t.custom && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (standard)
                        </span>
                      )}
                    </span>
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => startEditService(t.id, t.name)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-red-600 hover:text-red-600"
                        onClick={() => {
                          settingsStore.removeServiceType(t.id)
                          toast.success('Service type removed.')
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ),
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="New service type e.g. Vespers"
              />
              <Button
                variant="outline"
                onClick={() => {
                  if (!serviceName.trim()) return
                  settingsStore.addServiceType(serviceName.trim())
                  setServiceName('')
                  toast.success('Service type added.')
                }}
              >
                <Plus className="size-4" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Duty Roles</CardTitle>
            <CardDescription>
              Special duties like OIC, Pangulong Mang-aawit, Kalihim, and
              Organista. Rename or remove any entry.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-1 rounded-md border p-3 text-sm">
              {dutyRoles.length === 0 && (
                <p className="text-muted-foreground">No duty roles yet.</p>
              )}
              {dutyRoles.map((r) =>
                editingDutyId === r.id ? (
                  <div key={r.id} className="flex items-center gap-2 rounded px-1 py-0.5">
                    <Input
                      value={editDutyName}
                      onChange={(e) => setEditDutyName(e.target.value)}
                      className="h-8 flex-1"
                      placeholder="Role name"
                    />
                    <Input
                      value={editDutyAbbr}
                      onChange={(e) => setEditDutyAbbr(e.target.value)}
                      className="h-8 w-20"
                      placeholder="Abbr"
                    />
                    <Button size="icon-sm" onClick={saveEditDuty}>
                      <Check className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditingDutyId(null)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded px-2 py-1 hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1">
                      {r.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {r.abbreviation}
                      </span>
                      {!r.custom && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (standard)
                        </span>
                      )}
                    </span>
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => startEditDuty(r.id, r.name, r.abbreviation)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-red-600 hover:text-red-600"
                        onClick={() => {
                          settingsStore.removeDutyRole(r.id)
                          toast.success('Duty role removed.')
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ),
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={dutyName}
                onChange={(e) => setDutyName(e.target.value)}
                placeholder="Role name"
                className="flex-1"
              />
              <Input
                value={dutyAbbr}
                onChange={(e) => setDutyAbbr(e.target.value)}
                placeholder="Abbr"
                className="w-20"
              />
              <Button
                variant="outline"
                onClick={() => {
                  if (!dutyName.trim()) return
                  settingsStore.addDutyRole(
                    dutyName.trim(),
                    dutyAbbr.trim() || dutyName.trim().slice(0, 3).toUpperCase(),
                  )
                  setDutyName('')
                  setDutyAbbr('')
                  toast.success('Duty role added.')
                }}
              >
                <Plus className="size-4" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Voice Positions</CardTitle>
          <CardDescription>
            The voice sections of the choir (S1, S2, Alto, Tenor, Bass). Rename,
            remove, or add voices. They appear in forms, the Suguan Builder, and
            exports.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-1 rounded-md border p-3 text-sm">
            {voices.length === 0 && (
              <p className="text-muted-foreground">No voice positions yet.</p>
            )}
            {voices.map((v) =>
              editingVoiceId === v.id ? (
                <div key={v.id} className="flex items-center gap-2 rounded px-1 py-0.5">
                  <Input
                    value={editVoiceName}
                    onChange={(e) => setEditVoiceName(e.target.value)}
                    className="h-8 flex-1"
                    placeholder="Voice name"
                  />
                  <Select
                    value={editVoiceGender}
                    onValueChange={(val) =>
                      setEditVoiceGender(val as 'male' | 'female')
                    }
                  >
                    <SelectTrigger className="h-8 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">Women</SelectItem>
                      <SelectItem value="male">Men</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="icon-sm" onClick={saveEditVoice}>
                    <Check className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditingVoiceId(null)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded px-2 py-1 hover:bg-muted"
                >
                  <span className="min-w-0 flex-1">
                    {v.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {v.gender === 'female' ? 'Women' : 'Men'}
                    </span>
                    {!v.custom && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (standard)
                      </span>
                    )}
                  </span>
                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => startEditVoice(v.id, v.name, v.gender)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-red-600 hover:text-red-600"
                      onClick={() => {
                        settingsStore.removeVoice(v.id)
                        toast.success('Voice position removed.')
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ),
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              placeholder="New voice e.g. Alto 2"
              className="flex-1"
            />
            <Select
              value={voiceGender}
              onValueChange={(v) => setVoiceGender(v as 'male' | 'female')}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Women</SelectItem>
                <SelectItem value="male">Men</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                if (!voiceName.trim()) return
                settingsStore.addVoice(voiceName.trim(), voiceGender)
                setVoiceName('')
                toast.success('Voice position added.')
              }}
            >
              <Plus className="size-4" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>
            All data is stored in this browser via LocalStorage. Export a backup
            to move data between devices, or to prepare for cloud migration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <Label className="font-normal">
              {memberStore.members.length} members
            </Label>
            <Label className="font-normal">
              {memberStore.trainees.length} trainees
            </Label>
            <Label className="font-normal">
              {suguanStore.suguan.length} Suguan records
            </Label>
            <Label className="font-normal">
              {settingsStore.serviceTypes.length} service types
            </Label>
            <Label className="font-normal">
              {settingsStore.dutyRoles.length} duty roles
            </Label>
            <Label className="font-normal">
              {settingsStore.voices.length} voices
            </Label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="size-4" />
              Export Backup (JSON)
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" />
              Import Backup
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImportFile(file)
                e.target.value = ''
              }}
            />
            <Button
              variant="outline"
              onClick={() => setConfirmReset(true)}
            >
              <RotateCcw className="size-4" />
              Reset Demo Data
            </Button>
            <Button
              variant="destructive"
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 className="size-4" />
              Clear All Data
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to demo data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all current data with the STA. Monica choir
              roster seed data. Your current records will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                memberStore.resetDemoData()
                suguanStore.resetDemoData()
                settingsStore.resetDemoData()
                toast.success('Demo data restored.')
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all members, trainees, Suguan
              records, and settings from this browser. Export a backup first if
              you need to keep your data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white"
              onClick={() => {
                memberStore.clear()
                suguanStore.clear()
                settingsStore.clear()
                toast.success('All data cleared.')
              }}
            >
              Clear Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}