import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Download, Trash2, Upload } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { GenderBadge } from '@/components/StatusBadges'
import { useMemberStore } from '@/store/memberStore'
import { useSuguanStore } from '@/store/suguanStore'
import { useSettingsStore } from '@/store/settingsStore'
import { phtInstantISO, phtStampForFilename } from '@/lib/phDate'
import { MobileSettingsHeader } from './MobileSettingsHeader'
import { SettingsList } from './SettingsList'
import { deriveAbbreviation } from './referenceList'
import { useAuthStore } from '@/store/authStore'
import { useAdminStore } from '@/store/adminStore'

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
  const account = useAuthStore((state) =>
    state.accounts.find((item) => item.id === state.currentAccountId),
  )
  const isAdmin = account?.role === 'admin' && (account.status ?? 'active') === 'active'
  const memberStore = useMemberStore()
  const suguanStore = useSuguanStore()
  const settingsStore = useSettingsStore()
  const addAuditLog = useAdminStore((state) => state.addAuditLog)

  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmClearMasterList, setConfirmClearMasterList] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const serviceTypes = settingsStore.allServiceTypes()
  const dutyRoles = settingsStore.allDutyRoles()
  const voices = settingsStore.allVoices()
  const logAdminAction = (action: string, details: string) => {
    if (!isAdmin || !account) return
    addAuditLog({
      actorId: account.id,
      actorName: account.fullName,
      actorUsername: account.username,
      action,
      module: 'System Configuration',
      details,
    })
  }

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
    logAdminAction('Exported System Backup', 'Downloaded a browser backup file.')
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
        logAdminAction('Restored System Backup', 'Imported a browser backup file.')
        toast.success('Backup imported successfully.')
      } catch {
        toast.error('Could not read this file. Please select a JSON backup.')
      }
    }
    reader.readAsText(file)
  }

// AFTER:
  return (
    <div className="flex flex-col gap-4 w-full">
      <MobileSettingsHeader />
      <PageHeader
        className="hidden md:flex"
        title="Settings"
        description="Configure voices, choir positions, duty roles, and service types."
      />

      <Tabs defaultValue="general" className="flex flex-col w-full">
        <TabsList variant="line" className="flex flex-row justify-start gap-6 border-b pb-2 w-full">
          <TabsTrigger
            value="general"
            className="data-[state=active]:bg-muted! data-[state=active]:text-brand-navy! after:hidden!"
          >
            System Configuration
          </TabsTrigger>
          <TabsTrigger
            value="data"
            className="data-[state=active]:bg-muted! data-[state=active]:text-brand-navy! after:hidden!"
          >
            Data Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
  <div className="flex flex-col gap-4">
    <SettingsList
      items={serviceTypes}
      title="Service Types"
      description="Manage the worship services and special occasions available when creating Suguan."
      noun="service type"
      fields={[
        {
          key: 'name',
          label: 'Service type name',
          placeholder: 'e.g. Vespers',
        },
      ]}
      getLabel={(t) => t.name}
      onCreate={(v) => {
        settingsStore.addServiceType(v.name.trim())
        logAdminAction('Created Service Type', v.name.trim())
      }}
      onUpdate={(id, v) => {
        settingsStore.updateServiceType(id, { name: v.name.trim() })
        logAdminAction('Updated Service Type', v.name.trim())
      }}
      onDelete={(id) => {
        settingsStore.removeServiceType(id)
        logAdminAction('Deleted Service Type', id)
      }}
      onMove={(id, toIndex) => {
        settingsStore.moveServiceType(id, toIndex)
        logAdminAction('Reordered Service Types', `${id} moved to position ${toIndex + 1}`)
      }}
    />

    <SettingsList
      items={dutyRoles}
      title="Duty Roles"
      description="Manage special choir responsibilities and privileges."
      noun="duty role"
      fields={[
        {
          key: 'name',
          label: 'Role name',
          placeholder: 'e.g. Organista',
        },
        {
          key: 'abbreviation',
          label: 'Abbreviation',
          placeholder: 'e.g. Org',
        },
      ]}
      getLabel={(r) => r.name}
      getMeta={(r) => r.abbreviation}
      onCreate={(v) => {
        const name = v.name.trim()
        settingsStore.addDutyRole(
          name,
          v.abbreviation.trim() || deriveAbbreviation(name),
        )
        logAdminAction('Created Duty Role', name)
      }}
      onUpdate={(id, v) => {
        const name = v.name.trim()
        settingsStore.updateDutyRole(id, {
          name,
          abbreviation:
            v.abbreviation.trim() || deriveAbbreviation(name),
        })
        logAdminAction('Updated Duty Role', name)
      }}
      onDelete={(id) => {
        settingsStore.removeDutyRole(id)
        logAdminAction('Deleted Duty Role', id)
      }}
      onMove={(id, toIndex) => {
        settingsStore.moveDutyRole(id, toIndex)
        logAdminAction('Reordered Duty Roles', `${id} moved to position ${toIndex + 1}`)
      }}
    />

    <SettingsList
      items={voices}
      title="Voice Positions"
      description="Manage choir voice sections used in member profiles and assignments."
      noun="voice position"
      fields={[
        {
          key: 'name',
          label: 'Voice name',
          placeholder: 'e.g. Soprano',
        },
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
      extraBadges={(v) => <GenderBadge gender={v.gender} />}
      onCreate={(v) => {
        settingsStore.addVoice(
          v.name.trim(),
          v.gender === 'male' ? 'male' : 'female',
        )
        logAdminAction('Created Voice Position', v.name.trim())
      }}
      onUpdate={(id, v) => {
        settingsStore.updateVoice(id, {
          name: v.name.trim(),
          gender: v.gender === 'male' ? 'male' : 'female',
        })
        logAdminAction('Updated Voice Position', v.name.trim())
      }}
      onDelete={(id) => {
        settingsStore.removeVoice(id)
        logAdminAction('Deleted Voice Position', id)
      }}
      onMove={(id, toIndex) => {
        settingsStore.moveVoice(id, toIndex)
        logAdminAction('Reordered Voice Positions', `${id} moved to position ${toIndex + 1}`)
      }}
    />
  </div>
</TabsContent>
        <TabsContent value="data" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>
                All data is stored in this browser via LocalStorage. Export a
                backup to move data between devices, or to prepare for cloud
                migration.
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
                  variant="destructive"
                  onClick={() => setConfirmClear(true)}
                >
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
                  records, and settings from this browser. Export a backup
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
                    logAdminAction('Cleared System Data', 'Cleared members, trainees, Suguan records, and settings.')
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
                  This will permanently delete all members and trainees from
                  this browser. Suguan history and settings are kept.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white"
                  onClick={() => {
                    memberStore.clear()
                    logAdminAction('Cleared Master List', 'Cleared all choir members and trainees.')
                    toast.success('Master List cleared.')
                  }}
                >
                  Clear Master List
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>
      </Tabs>
    </div>
  )
}
