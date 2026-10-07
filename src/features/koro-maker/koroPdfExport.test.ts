import assert from 'node:assert/strict'
import test from 'node:test'
import type { KoroDocument } from '@/core/types/koro'
import type { Member } from '@/core/types/member'
import { createKoroDocument } from '@/lib/koro'
import { exportKoroAsSuguanPdf } from './koroPdfExport.ts'

const members: Member[] = [
  {
    id: 'soprano-1-member',
    firstName: 'Kim',
    lastName: 'Arancillo',
    gender: 'female',
    voicePosition: 'soprano-1',
    membershipType: 'regular',
    isActive: true,
    dateAdded: '2026-01-01',
    positions: [],
  },
  {
    id: 'soprano-2-member',
    firstName: 'Silvanny',
    lastName: 'Biolango',
    gender: 'female',
    voicePosition: 'soprano-2',
    membershipType: 'regular',
    isActive: true,
    dateAdded: '2026-01-01',
    positions: [],
  },
]

function documentWithSopranoMembers(): KoroDocument {
  const document = createKoroDocument()
  document.title = 'Thanksgiving'
  document.date = '2026-12-19'
  document.tables[0].rows[0].cells[0] = {
    memberId: members[0].id,
    firstName: members[0].firstName,
    voicePosition: members[0].voicePosition,
  }
  document.tables[0].rows[0].cells[1] = {
    memberId: members[1].id,
    firstName: members[1].firstName,
    voicePosition: members[1].voicePosition,
  }
  return document
}

test('Suguan PDF preview keeps combined soprano heading and last-name-first names', async () => {
  const pdf = await exportKoroAsSuguanPdf(
    documentWithSopranoMembers(),
    members,
    undefined,
    'preview',
  )

  assert.ok(pdf instanceof Blob)
  assert.equal(pdf.type, 'application/pdf')
  const pdfContent = await pdf.text()
  assert.match(pdfContent, /\(SOPRANO\)/)
  assert.match(pdfContent, /\(Arancillo, Kim\)/)
  assert.match(pdfContent, /\(Biolango, Silvanny\)/)
  assert.doesNotMatch(pdfContent, /\(SOPRANO 1\)|\(SOPRANO 2\)/)
  assert.doesNotMatch(pdfContent, /0(?:\.0*)?\s+0(?:\.0*)?\s+0(?:\.0*)?\s+rg/)
})
