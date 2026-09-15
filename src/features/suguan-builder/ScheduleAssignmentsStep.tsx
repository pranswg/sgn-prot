import { useAssignmentPresetStore } from '@/store/assignmentPresetStore'
import { findPresetByKey } from '@/core/constants/worshipSchedules'
import { REGULAR_WORSHIP_DUTY_ROLES } from '@/core/constants/dutyRoles'
import type { Member } from '@/core/types/member'
import type { SuguanDraft } from './SuguanBuilderPage'
import { VoiceAssignmentsStep } from './VoiceAssignmentsStep'
import { DutyRolesPanel } from './DutyRolesPanel'

interface ScheduleAssignmentsStepProps {
  draft: SuguanDraft
  patch: (p: Partial<SuguanDraft>) => void
  members: Member[]
}

export function ScheduleAssignmentsStep({
  draft,
  patch,
  members,
}: ScheduleAssignmentsStepProps) {
  const presets = useAssignmentPresetStore((s) => s.presets)

  if (draft.schedules.length === 0) {
    return (
      <VoiceAssignmentsStep
        draft={draft}
        patch={patch}
        members={members}
        includeDutyRoles
      />
    )
  }

  const setSectionAssignments = (sectionId: string, nextAssignments: typeof draft.assignments) => {
    const schedules = draft.schedules.map((s) =>
      s.id === sectionId ? { ...s, assignments: nextAssignments } : s,
    )
    patch({
      schedules,
      assignments: schedules.flatMap((s) => s.assignments),
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {draft.schedules.map((section, i) => {
        const preset = section.scheduleKey
          ? findPresetByKey(presets, section.scheduleKey)
          : null
        return (
          <div
            key={section.id}
            className="rounded-lg border border-border/70 bg-card p-4"
          >
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {i + 1}. {section.scheduleLabel}
              </h3>
              <span className="text-xs text-muted-foreground">
                {section.assignments.length} assigned
                {preset ? ` · preset: ${preset.name}` : ''}
              </span>
            </div>
            <VoiceAssignmentsStep
              draft={draft}
              patch={patch}
              members={members}
              assignments={section.assignments}
              onAssignmentsChange={(next) => setSectionAssignments(section.id, next)}
              sectionTitle={`${section.scheduleLabel} — Roster`}
              initialPresetId={preset?.id}
            />
          </div>
        )
      })}

      <DutyRolesPanel
        draft={draft}
        patch={patch}
        members={members}
        roleIds={REGULAR_WORSHIP_DUTY_ROLES}
      />
    </div>
  )
}