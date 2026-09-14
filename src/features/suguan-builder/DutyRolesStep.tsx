import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useSettingsStore } from '@/store/settingsStore'
import type { Member } from '@/core/types/member'
import type { SuguanDraft } from './SuguanBuilderPage'

interface DutyRolesStepProps {
  draft: SuguanDraft
  patch: (p: Partial<SuguanDraft>) => void
  members: Member[]
}

export function DutyRolesStep({ draft, patch, members }: DutyRolesStepProps) {
  const allDutyRoles = useSettingsStore((s) => s.allDutyRoles)
  const [query, setQuery] = useState('')

  const roles = allDutyRoles()

  const activeMembers = members.filter((m) => m.isActive)
  const filteredMembers = query.trim()
    ? activeMembers.filter((m) =>
        `${m.firstName} ${m.lastName}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      )
    : activeMembers

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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Special Duty Roles</h2>
        <p className="text-sm text-muted-foreground">
          Designate the OIC of the Group and other special duties. A member may
          hold a duty role while also singing in a voice position.
        </p>
      </div>

      {duplicateIds.size > 0 && (
        <div className="rounded-md border border-red-400 bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">
          <AlertTriangle className="mr-1 inline size-4" />
          A member cannot hold more than one special duty role in the same
          Suguan. Review your assignments below.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {roles.map((role) => {
          const current = getDuty(role.id)
          const isDuplicate = current && duplicateIds.has(current.memberId)
          return (
            <Card key={role.id} className={isDuplicate ? 'border-red-400' : ''}>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">
                  {role.name}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {role.abbreviation}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Select
                  value={current?.memberId ?? 'none'}
                  onValueChange={(v) => {
                    if (v === 'none') {
                      patch({
                        dutyRoles: draft.dutyRoles.filter(
                          (d) => d.dutyRoleId !== role.id,
                        ),
                      })
                    } else {
                      const member = members.find((m) => m.id === v)
                      if (member) {
                        patch({
                          dutyRoles: [
                            ...draft.dutyRoles.filter(
                              (d) => d.dutyRoleId !== role.id,
                            ),
                            {
                              dutyRoleId: role.id,
                              memberId: member.id,
                              memberName: `${member.firstName} ${member.lastName}`,
                            },
                          ],
                        })
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {current?.memberName ?? 'Select member'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    <div className="relative border-b px-2 pb-2">
                      <Search className="absolute left-4 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search members..."
                        className="h-8 pl-8"
                      />
                    </div>
                    <SelectItem value="none" className="text-muted-foreground">
                      — None —
                    </SelectItem>
                    {filteredMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.firstName} {m.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isDuplicate && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    This member already holds another duty role in this Suguan.
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}