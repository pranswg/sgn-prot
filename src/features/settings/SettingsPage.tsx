import { useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Download,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
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
  customServiceTypes: unknown[]
  customDutyRoles: unknown[]
  customVoices: unknown[]
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

  const handleExport = () => {
    const backup: BackupFile = {
      app: 'inc-choir-manager',
      version: 1,
      exportedAt: new Date().toISOString(),
      members: memberStore.members,
      trainees: memberStore.trainees,
      suguan: suguanStore.suguan,
      customServiceTypes: settingsStore.customServiceTypes,
      customDutyRoles: settingsStore.customDutyRoles,
      customVoices: settingsStore.customVoices,
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
          data.customServiceTypes as never,
          data.customDutyRoles as never,
          data.customVoices as never,
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
            <CardTitle>Custom Service Types</CardTitle>
            <CardDescription>
              Additional service types beyond the standard schedule.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-1 rounded-md border p-3 text-sm">
              {settingsStore.allServiceTypes().length === 0 && (
                <p className="text-muted-foreground">No service types yet.</p>
              )}
              {settingsStore.allServiceTypes().map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded px-2 py-1 hover:bg-muted"
                >
                  <span>
                    {t.name}
                    {!t.custom && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (standard)
                      </span>
                    )}
                  </span>
                  {t.custom && (
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
                  )}
                </div>
              ))}
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
            <CardTitle>Custom Duty Roles</CardTitle>
            <CardDescription>
              Additional duty roles beyond OIC, Pangulong Mang-aawit, Kalihim, and
              Organista. Duty roles are separate from voice positions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-1 rounded-md border p-3 text-sm">
              {settingsStore.allDutyRoles().length === 0 && (
                <p className="text-muted-foreground">No duty roles yet.</p>
              )}
              {settingsStore.allDutyRoles().map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded px-2 py-1 hover:bg-muted"
                >
                  <span>
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
                  {r.custom && (
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
                  )}
                </div>
              ))}
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
            Standard voice positions (S1, S2, Alto, Tenor, Bass) plus any
            custom voices you add. Custom voices appear in forms, the Suguan
            Builder, and exports.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-1 rounded-md border p-3 text-sm">
            {settingsStore.allVoices().length === 0 && (
              <p className="text-muted-foreground">No voice positions yet.</p>
            )}
            {settingsStore.allVoices().map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded px-2 py-1 hover:bg-muted"
              >
                <span>
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
                {v.custom && (
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
                )}
              </div>
            ))}
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
              {settingsStore.customServiceTypes.length +
                settingsStore.customDutyRoles.length +
                settingsStore.customVoices.length}{' '}
              custom items
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
              records, and custom settings from this browser. Export a backup
              first if you need to keep your data.
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