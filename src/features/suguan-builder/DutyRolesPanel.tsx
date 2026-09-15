import { useMemo, useState } from 'react'
import { AlertTriangle, Pencil, Plus, UserCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSettingsStore } from '@/store/settingsStore'
import type { Member } from '@/core/types/member'
import {
  DUTY_ROLE_REQUIRED_POSITIONS,
  memberCanHoldDutyRole,
  POSITION_LABELS,
} from '@/core/constants/choirPositions'
import type { SuguanDraft } from './SuguanBuilderPage'
import { MemberSelector } from './MemberSelector'

interface DutyRolesPanelProps {
  draft: SuguanDraft
  patch: (p: Partial<SuguanDraft>) => void
  members: Member[]
  roleIds?: string[]
}

function eligiblePositionText(roleId: string): string {
  const required = DUTY_ROLE_REQUIRED_POSITIONS[roleId]
  if (!required) return ''
  return required.map((p) => POSITION_LABELS[p]).join(' / ')
}

export function DutyRolesPanel({
  draft,
  patch,
  members,
  roleIds,
}: DutyRolesPanelProps) {
  const allDutyRoles = useSettingsStore((s) => s.allDutyRoles)
  const [pickerRoleId, setPickerRoleId] = useState<string | null>(null)

  const roles = allDutyRoles().filter(
    (role) => !roleIds || roleIds.includes(role.id),
  )

  const activeMembers = members.filter((m) => m.isActive)

  const dutyRoleCounts = new Map<string, number>()
  for (const d of draft.dutyRoles) {
    dutyRoleCounts.set(d.memberId, (dutyRoleCounts.get(d.memberId) ?? 0) + 1)
  }
  const duplicateIds = new Set(
    [...dutyRoleCounts.entries()]
      .filter(([, c]) => c > 1)
      .map(([id]) => id),
  )

  const getDuty = (roleId: string) =>
    draft.dutyRoles.find((d) => d.dutyRoleId === roleId)

  const pickerRole = pickerRoleId
    ? (roles.find((r) => r.id === pickerRoleId) ?? null)
    : null
  const pickerCurrentId = pickerRoleId ? getDuty(pickerRoleId)?.memberId : null

  const pickerCandidates = useMemo(
    () =>
      activeMembers.filter(
        (m) =>
          memberCanHoldDutyRole(m, pickerRoleId ?? '') &&
          !draft.dutyRoles.some(
            (d) => d.memberId === m.id && d.dutyRoleId !== pickerRoleId,
          ),
      ),
    [activeMembers, draft.dutyRoles, pickerRoleId],
  )

  const assignMember = (roleId: string, membersToAdd: Member[]) => {
    const member = membersToAdd[0]
    if (!member) return
    patch({
      dutyRoles: [
        ...draft.dutyRoles.filter((d) => d.dutyRoleId !== roleId),
        {
          dutyRoleId: roleId,
          memberId: member.id,
          memberName: `${member.firstName} ${member.lastName}`,
        },
      ],
    })
    setPickerRoleId(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Duty Roles & Leadership
        </h3>
        <p className="text-sm text-muted-foreground">
          Only members tagged with the matching position in their Master List
          profile are offered for each role. Organista and Assistant Tagapagturo
          are interchangeable.
        </p>
      </div>

      {duplicateIds.size > 0 && (
        <div className="rounded-md border border-red-400 bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">
          <AlertTriangle className="mr-1 inline size-4" />
          A member cannot hold more than one duty role in the same Suguan.
          Review the assignments below.
        </div>
      )}

      <Card>
        <CardContent className="pt-4">
          <div className="grid items-center gap-3 md:grid-cols-[1fr_3fr]">
            <div>
              <Label htmlFor="destinado-name">Destinado</Label>
              <p className="text-xs text-muted-foreground">
                Name printed on the right side of the signature block.
              </p>
            </div>
            <Input
              id="destinado-name"
              value={draft.destinadoName}
              onChange={(e) => patch({ destinadoName: e.target.value })}
              placeholder="e.g. Brother Juan Dela Cruz"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {roles.map((role) => {
          const current = getDuty(role.id)
          const isDuplicate = current && duplicateIds.has(current.memberId)
          const eligibleText = eligiblePositionText(role.id)
          return (
            <Card key={role.id} className={isDuplicate ? 'border-red-400' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  {role.name}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {role.abbreviation}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {current ? (
                  <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-2 py-1.5 text-sm">
                    <span className="min-w-0 truncate font-medium">
                      {current.memberName}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-6 shrink-0 text-muted-foreground hover:text-red-600"
                      title="Remove assignment"
                      onClick={() =>
                        patch({
                          dutyRoles: draft.dutyRoles.filter(
                            (d) => d.dutyRoleId !== role.id,
                          ),
                        })
                      }
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <p className="py-1 text-xs text-muted-foreground">
                    No member assigned yet.
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setPickerRoleId(role.id)}
                >
                  {current ? (
                    <Pencil className="size-4" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {current ? 'Change Member' : 'Assign Member'}
                </Button>
                {eligibleText && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <UserCheck className="size-3.5 shrink-0" />
                    Eligible: {eligibleText}
                  </p>
                )}
                {isDuplicate && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    This member already holds another duty role.
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog
        open={!!pickerRoleId}
        onOpenChange={(o) => !o && setPickerRoleId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pickerRole ? `${pickerRole.name} — Assign Member` : ''}
            </DialogTitle>
          </DialogHeader>
          {pickerRole && (
            <MemberSelector
              candidates={pickerCandidates}
              excludedIds={pickerCurrentId ? [pickerCurrentId] : []}
              conflictIds={duplicateIds}
              singleSelect
              onSelect={(m) => assignMember(pickerRole.id, m)}
              onClose={() => setPickerRoleId(null)}
              emptyMessage={
                eligiblePositionText(pickerRole.id)
                  ? `No active members tagged as ${eligiblePositionText(pickerRole.id)} are available for this role.`
                  : 'No eligible active members left for this role.'
              }
              addLabel="Assign Member"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}