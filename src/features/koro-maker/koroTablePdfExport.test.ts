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
  document.organistMemberId = 'francis'
  document.tables[0].title = 'PRINCIPAL CHOIR GROUP'
  document.tables[0].date = '2026-07-25'
  document.tables[0].time = '06:00'
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

test('table export prints one service line per table with its own date, day and time', async () => {
  const document = documentWithSeats()
  document.tables.push({
    ...document.tables[0],
    id: 'second-table',
    title: 'SECONDARY CHOIR GROUP',
  })
  const text = await pdfText(document)
  assert.match(text, /July 25, 2026 - SABADO 6:00AM/)
  assert.match(text, /PRINCIPAL CHOIR GROUP/)
  assert.match(text, /SECONDARY CHOIR GROUP/)
})

test('table export prints given names only and the voice key', async () => {
  const text = await pdfText(documentWithSeats())
  assert.match(text, /\(Kim\)/)
  assert.doesNotMatch(text, /\(Arancillo\)/)
  assert.match(text, /\(ALTO\)/)
  assert.match(text, /\(TENOR\)/)
})

test('a reserved seat prints its label instead of a name', async () => {
  const document = documentWithSeats()
  document.tables[0].rows[0].cells[1] = {
    memberId: null,
    firstName: '',
    voicePosition: '',
    label: 'Organ',
  }
  const text = await pdfText(document)
  assert.match(text, /\(ORGAN\)/)
})

test('a reserved seat expands over a blank seat above it in the same column', async () => {
  const document = documentWithSeats()
  // The organ sits on the second row with a blank seat above it, so the block
  // starts at the top row and covers both.
  document.tables[0].rows[1].cells[1] = {
    memberId: null,
    firstName: '',
    voicePosition: '',
    label: 'Organ',
  }
  const text = await pdfText(document)
  const heights = [...text.matchAll(/^[\d.]+ [\d.]+ [\d.]+ (-?[\d.]+) re$/gm)].map(
    (match) => Math.abs(Number(match[1])),
  )
  assert.ok(heights.length > 0)
  assert.ok(
    heights.some((height) => heights.some((base) => Math.abs(height - base * 2) < 0.01)),
    'expected one seat cell to be twice a normal row tall',
  )
})

test('a merged organ seat prints larger than the names around it', async () => {
  const document = documentWithSeats()
  document.tables[0].rows[1].cells[1] = {
    memberId: null,
    firstName: '',
    voicePosition: '',
    label: 'Organ',
  }
  const text = await pdfText(document)
  const sizeBefore = (marker: string) => {
    const markerAt = text.indexOf(`(${marker}) Tj`)
    assert.ok(markerAt >= 0, `expected ${marker} in the PDF`)
    // The last font-size operator before the text is the one that drew it.
    const matches = [...text.slice(0, markerAt).matchAll(/\/F\d+ ([\d.]+) Tf/g)]
    assert.ok(matches.length > 0)
    return Number(matches[matches.length - 1][1])
  }
  const organSize = sizeBefore('ORGAN')
  const nameSize = sizeBefore('Kim')
  assert.ok(
    organSize > nameSize * 1.4,
    `expected the organ label (${organSize}pt) to be much larger than a name (${nameSize}pt)`,
  )
})

test('a table holding the organ prints with taller rows than a plain table', async () => {
  const heightsOf = async (document: KoroDocument) => {
    const text = await pdfText(document)
    return [...text.matchAll(/^[\d.]+ [\d.]+ [\d.]+ (-?[\d.]+) re$/gm)].map(
      (match) => Math.abs(Number(match[1])),
    )
  }
  const plain = await heightsOf(documentWithSeats())
  const organ = documentWithSeats()
  organ.tables[0].rows[0].cells[1] = {
    memberId: null,
    firstName: '',
    voicePosition: '',
    label: 'Organ',
  }
  const withOrgan = await heightsOf(organ)
  assert.ok(Math.max(...withOrgan) > Math.max(...plain) * 2)
})

test('a reserved seat takes two seats of width', async () => {
  const document = documentWithSeats()
  document.tables[0].rows[0].cells[1] = {
    memberId: null,
    firstName: '',
    voicePosition: '',
    label: 'Organ',
  }
  const text = await pdfText(document)
  const widths = [
    ...text.matchAll(/^[\d.]+ [\d.]+ ([\d.]+) -?[\d.]+ re$/gm),
  ]
    .map((match) => Number(match[1]))
    // Over ~21mm keeps the legend swatches out of the comparison.
    .filter((width) => width > 60)
  assert.ok(widths.length > 0)
  assert.ok(
    Math.max(...widths) > Math.min(...widths) * 1.5,
    'expected one seat cell to be wider than the rest',
  )
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
