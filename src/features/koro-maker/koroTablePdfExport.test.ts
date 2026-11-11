import assert from 'node:assert/strict'
import test from 'node:test'
import type { KoroDocument } from '@/core/types/koro'
import type { Member } from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'
import { createKoroDocument } from '@/lib/koro'
import { exportKoroTablePdf } from './koroTablePdfExport.ts'

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

function documentWithSeats(): KoroDocument {
  const document = createKoroDocument()
  document.title = 'Anniversary Thanksgiving 2026'
  document.date = '2026-07-25'
  document.serviceTime = '6:00 AM'
  document.organistMemberId = 'francis'
  document.tables[0].title = 'PRINCIPAL CHOIR GROUP'
  document.tables[0].rows[2].cells[0] = {
    memberId: 'kim',
    firstName: 'Kim',
    voicePosition: 'alto',
  }
  return document
}

async function pdfText(document: KoroDocument): Promise<string> {
  const blob = await exportKoroTablePdf(
    document,
    members,
    voices,
    undefined,
    { localeName: 'Sta. Monica', output: 'preview' },
  )
  assert.ok(blob instanceof Blob)
  assert.equal(blob.type, 'application/pdf')
  return blob.text()
}

test('table export prints the heading block, occasion and organist', async () => {
  const text = await pdfText(documentWithSeats())
  assert.match(text, /STA\. MONICA CHOIR/)
  assert.match(text, /Anniversary Thanksgiving 2026/)
  assert.match(text, /ORGANIST: Francis William Garcia/)
})

test('table export prints one service line per table with its date and title', async () => {
  const document = documentWithSeats()
  document.tables.push({
    ...document.tables[0],
    id: 'second-table',
    title: 'SECONDARY CHOIR GROUP',
  })
  const text = await pdfText(document)
  assert.match(text, /JULY 25, 2026/)
  assert.match(text, /SABADO/)
  assert.match(text, /6:00 AM/)
  assert.match(text, /PRINCIPAL CHOIR GROUP/)
  assert.match(text, /SECONDARY CHOIR GROUP/)
})

test('table export prints names given-name-over-surname and the voice key', async () => {
  const text = await pdfText(documentWithSeats())
  assert.match(text, /\(Kim\)/)
  assert.match(text, /\(Arancillo\)/)
  assert.match(text, /\(ALTO\)/)
  assert.match(text, /\(TENOR\)/)
})

test('an empty date and title still produce a printable sheet', async () => {
  const document = createKoroDocument()
  document.title = ''
  document.date = ''
  document.tables[0].title = ''
  const text = await pdfText(document)
  assert.match(text, /CHOIR/)
  assert.match(text, /KORO/)
})
