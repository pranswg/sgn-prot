import { useState } from 'react'
import { ArrowLeft, FileText, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
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
import { useSuguanStore } from '@/store/suguanStore'
import { useNavStore } from '@/store/navStore'
import { useSettingsStore } from '@/store/settingsStore'
import { formatDateLong, formatTime } from '@/lib/format'
import { toast } from 'sonner'

export function SuguanDetailPage() {
  const selectedSuguanId = useNavStore((s) => s.selectedSuguanId)
  const suguan = useSuguanStore((s) => s.suguan)
  const deleteSuguan = useSuguanStore((s) => s.deleteSuguan)
  const navigate = useNavStore((s) => s.navigate)
  const editSuguanInBuilder = useNavStore((s) => s.editSuguanInBuilder)
  const allServiceTypes = useSettingsStore((s) => s.allServiceTypes)
  const allDutyRoles = useSettingsStore((s) => s.allDutyRoles)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const voices = allVoices()

  const s = suguan.find((su) => su.id === selectedSuguanId) ?? null

  const [deleteOpen, setDeleteOpen] = useState(false)

  if (!s) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Suguan Not Found"
          actions={
            <Button variant="outline" onClick={() => navigate('suguan-history')}>
              <ArrowLeft className="size-4" />
              Back to History
            </Button>
          }
        />
        <p className="text-muted-foreground">
          The Suguan record could not be loaded.
        </p>
      </div>
    )
  }

  const serviceName =
    allServiceTypes().find((t) => t.id === s.serviceTypeId)?.name ??
    s.serviceTypeId

  const sections = voices
    .map((v) => ({
      voice: v,
      assignments: s.assignments.filter((a) => a.voicePosition === v.id),
    }))
    .filter((sec) => sec.assignments.length > 0)

  const dutyRoleAssignments = allDutyRoles().flatMap((role) => {
    const d = s.dutyRoles.find((r) => r.dutyRoleId === role.id)
    return d ? [{ role, memberName: d.memberName }] : []
  })

  const pangulongName = s.dutyRoles.find(
    (d) => d.dutyRoleId === 'pangulong-mang-aawit',
  )?.memberName

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`${serviceName} — ${formatDateLong(s.date)}`}
        description={s.time ? formatTime(s.time) : ''}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('suguan-history')}>
              <ArrowLeft className="size-4" />
              History
            </Button>
            <Button variant="outline" onClick={() => editSuguanInBuilder(s.id)}>
              <FileText className="size-4" />
              Edit
            </Button>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-3xl rounded-md border bg-card p-6 shadow-sm sm:p-10">
        <div className="mb-8 text-center">
          <h2 className="text-base font-semibold uppercase tracking-wide sm:text-lg">
            Suguan ng mga Mang-aawit sa Pagtupad ng {serviceName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateLong(s.date)}
            {s.time ? ` • ${formatTime(s.time)}` : ''}
            {s.location ? ` • ${s.location}` : ''}
          </p>
          {s.notes && (
            <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
              {s.notes}
            </p>
          )}
        </div>

        {sections.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No members are assigned to this Suguan yet.
          </p>
        ) : (
          <div className="space-y-8">
            {sections.map(({ voice, assignments }) => (
              <div key={voice.id}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {voice.name}
                </h3>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border border-foreground/20 bg-muted/50">
                      <th className="w-12 border border-foreground/20 px-2 py-1.5 text-left font-semibold">
                        Blg.
                      </th>
                      <th className="border border-foreground/20 px-3 py-1.5 text-left font-semibold">
                        Pangalan
                      </th>
                      <th className="w-32 border border-foreground/20 px-2 py-1.5 text-center font-semibold">
                        Lagda
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((a, i) => (
                      <tr key={`${a.memberId}-${a.voicePosition}`}>
                        <td className="border border-foreground/20 px-2 py-1.5 text-muted-foreground">
                          {i + 1}
                        </td>
                        <td className="border border-foreground/20 px-3 py-1.5">
                          {a.memberName}
                        </td>
                        <td className="border border-foreground/20 px-2 py-1.5 empty:hidden" />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            {dutyRoleAssignments.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Naka-Tungkulin
                </h3>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border border-foreground/20 bg-muted/50">
                      <th className="w-12 border border-foreground/20 px-2 py-1.5 text-left font-semibold">
                        Blg.
                      </th>
                      <th className="w-1/2 border border-foreground/20 px-3 py-1.5 text-left font-semibold">
                        Tungkulin
                      </th>
                      <th className="border border-foreground/20 px-3 py-1.5 text-left font-semibold">
                        Pangalan
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dutyRoleAssignments.map(({ role, memberName }, i) => (
                      <tr key={role.id}>
                        <td className="border border-foreground/20 px-2 py-1.5 text-muted-foreground">
                          {i + 1}
                        </td>
                        <td className="border border-foreground/20 px-3 py-1.5">
                          {role.name}
                        </td>
                        <td className="border border-foreground/20 px-3 py-1.5">
                          {memberName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="mt-12 grid grid-cols-2 gap-6">
          <div className="text-center">
            <div className="mx-auto h-px w-full max-w-52 border-b border-foreground/40" />
            <p className="mt-6 text-sm font-medium">
              {pangulongName ?? '____________________'}
            </p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Pangulong Mang-aawit
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto h-px w-full max-w-52 border-b border-foreground/40" />
            <p className="mt-6 text-sm font-medium">____________________</p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Destinado
            </p>
          </div>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Suguan?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The Suguan record will be permanently
              removed from history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white"
              onClick={() => {
                deleteSuguan(s.id)
                toast.success('Suguan deleted.')
                navigate('suguan-history')
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}