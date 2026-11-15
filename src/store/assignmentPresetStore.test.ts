import assert from 'node:assert/strict'
import test from 'node:test'

import type { SuguanAssignment, SuguanDutyRole } from '@/core/types/suguan'
import { useAssignmentPresetStore } from './assignmentPresetStore.ts'

function assignment(memberId: string, voicePosition = 'soprano'): SuguanAssignment {
  return {
    memberId,
    memberName: `Member ${memberId}`,
    voicePosition,
    assignedAt: '2026-01-01T00:00:00.000Z',
  }
}

function reset() {
  useAssignmentPresetStore.getState().clear()
}

test('updating a preset replaces its roster in place', () => {
  reset()
  const created = useAssignmentPresetStore
    .getState()
    .savePreset('Sunday', [assignment('m1')], [])

  const duties: SuguanDutyRole[] = [
    {
      memberId: 'm2',
      memberName: 'Member m2',
      dutyRoleId: 'oic',
      scheduleId: 's1',
    },
  ]
  const updated = useAssignmentPresetStore
    .getState()
    .updatePreset(
      created.id,
      'Sunday PM',
      [assignment('m2'), assignment('m3', 'alto')],
      duties,
    )

  const presets = useAssignmentPresetStore.getState().presets
  assert.equal(presets.length, 1, 'an update must never add a second preset')
  assert.equal(updated?.id, created.id)
  assert.equal(updated?.createdAt, created.createdAt)
  assert.equal(presets[0]?.name, 'Sunday PM')
  assert.deepEqual(
    presets[0]?.assignments.map((a) => a.memberId),
    ['m2', 'm3'],
  )
  assert.deepEqual(presets[0]?.dutyRoles, duties)
  // A preset stores a snapshot, never a live timestamp.
  assert.equal(presets[0]?.assignments[0]?.assignedAt, '')
})

test('updating an unknown preset leaves the list untouched', () => {
  reset()
  useAssignmentPresetStore
    .getState()
    .savePreset('Sunday', [assignment('m1')], [])
  const before = useAssignmentPresetStore.getState().presets

  const result = useAssignmentPresetStore
    .getState()
    .updatePreset('missing', 'Renamed', [assignment('m2')], [])

  assert.equal(result, null)
  assert.deepEqual(useAssignmentPresetStore.getState().presets, before)
})
