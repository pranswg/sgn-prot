import { useMemo } from 'react'
import { ArrowLeft, Eye, FileText, Send, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { SuguanStatusBadge } from '@/components/StatusBadges'
import { detectConflicts, hasBlockingConflicts } from '@/lib/conflicts'
import { cn } from '@/lib/utils'
import { useMemberStore } from '@/store/memberStore'
import { useState } from 'react'
import { toast } from 'sonner'

export function SuguanDetailPage() {
  const selectedSuguanId = useNavStore((s) => s.selectedSuguanId)
  const suguan = useSuguanStore((s) => s.suguan)
  const setStatus = useSuguanStore((s) => s.setStatus)
  const deleteSuguan = useSuguanStore((s) => s.deleteSuguan)
  const navigate = useNavStore((s) => s.navigate)
  const editSuguanInBuilder = useNavStore((s) => s.editSuguanInBuilder)
  const allServiceTypes = useSettingsStore((s) => s.allServiceTypes)
  const allDutyRoles = useSettingsStore((s) => s.allDutyRoles)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const voices = allVoices()
  const members = useMemberStore((s) => s.members)

  const s = suguan.find((su) => su.id === selectedSuguanId) ?? null

  const conflicts = useMemo(() => {
    if (!s) return []
    return detectConflicts({ suguan: s, members, allSuguan: suguan })
  }, [s, members, suguan])
  const hasErrors = hasBlockingConflicts(conflicts)

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

  const dutyRole = (roleId: string) =>
    s.dutyRoles.find((d) => d.dutyRoleId === roleId)

  const dutyRoles = allDutyRoles()

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
            {s.status === 'draft' && (
              <Button
                variant="outline"
                onClick={() => editSuguanInBuilder(s.id)}
              >
                <FileText className="size-4" />
                Edit
              </Button>
            )}
            {s.status === 'draft' && !hasErrors && (
              <Button
                onClick={() => {
                  setStatus(s.id, 'published')
                  toast.success('Suguan published.')
                }}
              >
                <Send className="size-4" />
                Publish
              </Button>
            )}
            {s.status === 'published' && (
              <Button
                onClick={() => {
                  setStatus(s.id, 'completed')
                  toast.success('Suguan marked as completed.')
                }}
              >
                <Eye className="size-4" />
                Complete
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-4">
        <SuguanStatusBadge status={s.status} />
        {s.location && (
          <p className="text-sm text-muted-foreground">{s.location}</p>
        )}
        {s.notes && (
          <p className="text-sm text-muted-foreground">{s.notes}</p>
        )}
      </div>

      {conflicts.length > 0 && (
        <Card className={cn('border-red-400')}>
          <CardHeader>
            <CardTitle className="text-sm text-red-700 dark:text-red-300">
              Conflicts ({conflicts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {conflicts.map((c, i) => (
              <p
                key={i}
                className={cn(
                  'rounded px-2 py-1',
                  c.severity === 'error'
                    ? 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200'
                    : 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200',
                )}
              >
                {c.message}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Voice Sections</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {voices.map((v) => {
            const assigned = s.assignments.filter(
              (a) => a.voicePosition === v.id,
            )
            const capacity = s.voiceCapacities[v.id] ?? 0
            return (
              <div key={v.id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                    {v.name}
                  </h4>
                  <Badge variant="outline">
                    {assigned.length}/{capacity}
                  </Badge>
                </div>
                <div className="flex flex-col gap-0.5 rounded-md bg-muted p-2">
                  {assigned.length === 0 && (
                    <p className="text-xs text-muted-foreground">None</p>
                  )}
                  {assigned.map((a) => (
                    <p key={a.memberId} className="text-sm font-medium">
                      {a.memberName}
                    </p>
                  ))}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {dutyRoles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Special Duty Roles</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {dutyRoles.map((role) => {
              const d = dutyRole(role.id)
              return (
                <div key={role.id} className="rounded-md border p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {role.name}
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {d?.memberName ?? (
                      <span className="text-muted-foreground font-normal">
                        Unassigned
                      </span>
                    )}
                  </p>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

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