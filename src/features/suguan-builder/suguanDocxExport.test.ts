import assert from 'node:assert/strict'
import test from 'node:test'

import type { Suguan } from '@/core/types/suguan'
import { createSuguanDocxBlob } from './suguanDocxExport.ts'

const suguan: Suguan = {
  id: 'suguan-1',
  date: '2026-10-11',
  time: '09:00',
  serviceTypeId: 'pagsamba',
  group: 'babae',
  events: [{ id: 'event-1', type: 'pagsasanay', date: '2026-10-11' }],
  schedules: [
    {
      id: 'schedule-1',
      scheduleLabel: 'SABADO',
      scheduleDay: 'Sabado',
      scheduleTime: '7:00 PM',
      assignments: [
        {
          memberId: 'member-1',
          memberName: 'Ana Reyes',
          voicePosition: 'soprano-1',
          assignedAt: '2026-10-10T12:00:00.000Z',
        },
      ],
    },
  ],
  voiceCapacities: {},
  assignments: [],
  dutyRoles: [],
  createdAt: '2026-10-10T12:00:00.000Z',
  updatedAt: '2026-10-10T12:00:00.000Z',
}

test('choir Suguan DOCX builder creates a Word document blob', async () => {
  const blob = await createSuguanDocxBlob(suguan, [
    { id: 'member-1', firstName: 'Ana', lastName: 'Reyes' },
  ])

  assert.equal(
    blob.type,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  )
  assert.ok(blob.size > 0)
})
