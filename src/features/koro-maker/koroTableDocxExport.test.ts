import assert from 'node:assert/strict'
import test from 'node:test'
import type { KoroDocument } from '@/core/types/koro'
import type { Member } from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'
import { createKoroDocument } from '@/lib/koro'
import { createKoroTableDocxBlob } from './koroTableDocxExport.ts'

const voices: VoicePosition[] = [
  { id: 'alto', name: 'Alto', shortName: 'A', gender: 'female' },
  { id: 'tenor', name: 'Tenor', shortName: 'T', gender: 'male' },
]

const members: Member[] = [
  {
    id: 'kim',
    firstName: 'Kim',
    lastName: 'Arancillo',
    gender: 'female',
    voicePosition: 'alto',
    membershipType: 'regular',
    isActive: true,
    dateAdded: '2026-01-01',
    positions: [],
  },
  {
    id: 'francis',
    firstName: 'Francis William',
    lastName: 'Garcia',
    gender: 'male',
    voicePosition: 'tenor',
    membershipType: 'organista',
    isActive: true,
    dateAdded: '2026-01-01',
    positions: [],
  },
]

function documentWithOrgan(): KoroDocument {
  const document = createKoroDocument()
  document.title = 'Anniversary Thanksgiving 2026'
  document.organistMemberId = 'francis'
  document.tables[0].title = 'PRINCIPAL CHOIR GROUP'
  document.tables[0].date = '2026-07-25'
  document.tables[0].time = '06:00'
  document.tables[0].rows[2].cells[0] = {
    memberId: 'kim',
    firstName: 'Kim',
    voicePosition: 'alto',
  }
  // The organ follows a blank seat above it, so its block spans both rows.
  document.tables[0].rows[1].cells[1] = {
    memberId: null,
    firstName: '',
    voicePosition: '',
    label: 'Organ',
  }
  return document
}

test('table Word export creates a document blob', async () => {
  const blob = await createKoroTableDocxBlob(
    documentWithOrgan(),
    members,
    voices,
    { localeName: 'Sta. Monica' },
  )
  assert.equal(
    blob.type,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  )
  assert.ok(blob.size > 0)
})

test('table Word export survives an empty document', async () => {
  const document = createKoroDocument()
  document.title = ''
  const blob = await createKoroTableDocxBlob(document, members)
  assert.ok(blob.size > 0)
})
