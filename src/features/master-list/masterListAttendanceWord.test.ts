import assert from 'node:assert/strict'
import test from 'node:test'
import type { Member } from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'
import { createMasterListAttendanceWordBlob } from './masterListAttendanceWord.ts'

const member: Member = {
  id: 'member-1',
  firstName: 'Ana',
  lastName: 'Cruz',
  gender: 'female',
  voicePosition: 'soprano',
  membershipType: 'regular',
  isActive: true,
  dateAdded: '2026-01-01',
  positions: [],
}

const voices: VoicePosition[] = [
  { id: 'soprano', name: 'Soprano', shortName: 'S', gender: 'female' },
]

test('creates a Word attendance sheet with the configured page and signatory', async () => {
  const blob = await createMasterListAttendanceWordBlob({
    members: [member],
    trainees: [],
    voices,
    dates: ['2026-10-17'],
    title: 'Attendance Sheet',
    groupByVoice: true,
    selectedVoiceIds: ['soprano'],
    includeNagsasanayMen: false,
    includeNagsasanayWomen: false,
    lastNameFirst: false,
    paperSize: 'letter',
    orientation: 'portrait',
    choir: 'aws',
    pangulongName: 'Maria Santos',
    filename: 'attendance.docx',
  })

  test('creates a PNK Word attendance sheet without requiring a signatory', async () => {
    const blob = await createMasterListAttendanceWordBlob({
      members: [member],
      trainees: [],
      voices,
      dates: ['2026-10-17'],
      title: 'Attendance Sheet',
      groupByVoice: false,
      selectedVoiceIds: [],
      includeNagsasanayMen: false,
      includeNagsasanayWomen: false,
      lastNameFirst: false,
      paperSize: 'letter',
      orientation: 'portrait',
      choir: 'pnk',
      pangulongName: '',
      filename: 'pnk-attendance.docx',
    })

    assert.ok(blob.size > 0)
  })

  assert.ok(blob.size > 0)
  assert.equal(
    blob.type,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  )
})
