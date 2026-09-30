import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Download, Trash2, Upload } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ListEditor } from './ListEditor'
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
import { phtInstantISO, phtStampForFilename } from '@/lib/phDate'

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

  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmClearMasterList, setConfirmClearMasterList] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const serviceTypes = settingsStore.allServiceTypes()
  const dutyRoles = settingsStore.allDutyRoles()
  const voices = settingsStore.allVoices()

  const handleExport = () => {
    const backup: BackupFile = {
      app: 'inc-choir-manager',
      version: 2,
      exportedAt: phtInstantISO(),
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
    link.download = `inc-choir-backup-${phtStampForFilename()}.json`
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
          <CardContent>
            <ListEditor
              items={serviceTypes}
              noun="service type"
              fields={[
                {
                  key: 'name',
                  label: 'Service type name',
                  placeholder: 'e.g. Vespers',
                },
              ]}
              getLabel={(t) => t.name}
              onCreate={(v) => settingsStore.addServiceType(v.name.trim())}
              onUpdate={(id, v) =>
                settingsStore.updateServiceType(id, { name: v.name.trim() })
              }
              onDelete={(id) => settingsStore.removeServiceType(id)}
            />
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
          <CardContent>
            <ListEditor
              items={dutyRoles}
              noun="duty role"
              fields={[
                { key: 'name', label: 'Role name', placeholder: 'e.g. Organista' },
                {
                  key: 'abbreviation',
                  label: 'Abbreviation',
                  placeholder: 'e.g. Org',
                  className: 'w-24',
                },
              ]}
              getLabel={(r) => r.name}
              getMeta={(r) => r.abbreviation}
              onCreate={(v) => {
                const name = v.name.trim()
                settingsStore.addDutyRole(
                  name,
                  v.abbreviation.trim() || name.slice(0, 3).toUpperCase(),
                )
              }}
              onUpdate={(id, v) => {
                const name = v.name.trim()
                settingsStore.updateDutyRole(id, {
                  name,
                  abbreviation: v.abbreviation.trim() || name.slice(0, 3).toUpperCase(),
                })
              }}
              onDelete={(id) => settingsStore.removeDutyRole(id)}
            />
          </CardContent>
        </Card>
      </div>

        <Card>
          <CardHeader>
            <CardTitle>Voice Positions</CardTitle>
            <CardDescription>
              The voice sections of the choir (S1, S2, Alto, Tenor, Bass). Rename,
              change the section, or remove any entry.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ListEditor
              items={voices}
              noun="voice position"
              fields={[
                { key: 'name', label: 'Voice name', placeholder: 'e.g. Soprano' },
                {
                  key: 'gender',
                  label: 'Section',
                  options: [
                    { value: 'female', label: 'Female' },
                    { value: 'male', label: 'Male' },
                  ],
                },
              ]}
              getLabel={(v) => v.name}
              getMeta={(v) => v.gender === 'male' ? 'Male' : 'Female'}
              onCreate={(v) => settingsStore.addVoice(v.name.trim(), v.gender === 'male' ? 'male' : 'female')}
              onUpdate={(id, v) =>
                settingsStore.updateVoice(id, {
                  name: v.name.trim(),
                  gender: v.gender === 'male' ? 'male' : 'female',
                })
              }
              onDelete={(id) => settingsStore.removeVoice(id)}
            />
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
            <Button variant="destructive" onClick={() => setConfirmClear(true)}>
              <Trash2 className="size-4" />
              Clear All Data
            </Button>
            <Button
              variant="destructive"
              onClick={() => setConfirmClearMasterList(true)}
            >
              <Trash2 className="size-4" />
              Clear Master List
            </Button>
          </div>
        </CardContent>
      </Card>

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

      <AlertDialog
        open={confirmClearMasterList}
        onOpenChange={setConfirmClearMasterList}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the Master List?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all members and trainees from this
              browser. Suguan history and settings are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white"
              onClick={() => {
                memberStore.clear()
                toast.success('Master List cleared.')
              }}
            >
              Clear Master List
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
