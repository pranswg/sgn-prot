import assert from 'node:assert/strict'
import test from 'node:test'
import { inflateRawSync } from 'node:zlib'
import type { Member, Trainee } from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'
import { DEFAULT_DOC_FORMAT } from '@/lib/suguanUtils'
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

const tenor: Member = {
  ...member,
  id: 'member-2',
  firstName: 'Ben',
  lastName: 'Santos',
  gender: 'male',
  voicePosition: 'tenor',
}

const voices: VoicePosition[] = [
  { id: 'soprano', name: 'Soprano', shortName: 'S', gender: 'female' },
  { id: 'tenor', name: 'Tenor', shortName: 'T', gender: 'male' },
]

function trainee(id: string, firstName: string, gender: Trainee['gender']): Trainee {
  return {
    id,
    firstName,
    lastName: 'Trainee',
    gender,
    voicePosition: '',
    status: 'active',
    dateAdded: '2026-01-01',
  }
}

async function attendanceDocumentXml(blob: Blob): Promise<string> {
  const archive = Buffer.from(await blob.arrayBuffer())
  let offset = 0
  while (offset + 46 <= archive.length) {
    if (archive.readUInt32LE(offset) !== 0x02014b50) {
      offset += 1
      continue
    }
    const compression = archive.readUInt16LE(offset + 10)
    const compressedSize = archive.readUInt32LE(offset + 20)
    const fileNameLength = archive.readUInt16LE(offset + 28)
    const extraLength = archive.readUInt16LE(offset + 30)
    const commentLength = archive.readUInt16LE(offset + 32)
    const localHeaderOffset = archive.readUInt32LE(offset + 42)
    const fileName = archive
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString('utf8')
    if (fileName === 'word/document.xml') {
      const localFileNameLength = archive.readUInt16LE(localHeaderOffset + 26)
      const localExtraLength = archive.readUInt16LE(localHeaderOffset + 28)
      const dataStart =
        localHeaderOffset + 30 + localFileNameLength + localExtraLength
      const compressed = archive.subarray(dataStart, dataStart + compressedSize)
      return (compression === 8 ? inflateRawSync(compressed) : compressed)
        .toString('utf8')
    }
    offset += 46 + fileNameLength + extraLength + commentLength
  }
  throw new Error('DOCX archive does not contain word/document.xml')
}

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
    separateChoirs: false,
    lastNameFirst: false,
    docFormat: { ...DEFAULT_DOC_FORMAT, paperSize: 'letter' },
    choir: 'aws',
    pangulongName: 'Maria Santos',
    filename: 'attendance.docx',
  })

  assert.ok(blob.size > 0)
  const documentXml = await attendanceDocumentXml(blob)
  assert.match(documentXml, /<w:t[^>]*>10\/17\/2026<\/w:t>[\s\S]*<w:t[^>]*>Lagda<\/w:t>/)
  assert.match(documentXml, /<w:t[^>]*>Naghanda:<\/w:t>/)
  assert.match(documentXml, /<w:t[^>]*>Maria Santos<\/w:t>/)
  assert.equal(
    blob.type,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  )
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
    separateChoirs: false,
    lastNameFirst: false,
    docFormat: { ...DEFAULT_DOC_FORMAT, paperSize: 'letter' },
    choir: 'pnk',
    pangulongName: '',
    filename: 'pnk-attendance.docx',
  })

  assert.ok(blob.size > 0)
  const documentXml = await attendanceDocumentXml(blob)
  assert.match(documentXml, /<w:t[^>]*>10\/17\/2026<\/w:t>[\s\S]*<w:t[^>]*>Lagda<\/w:t>/)
  assert.doesNotMatch(documentXml, /<w:t[^>]*>Naghanda:<\/w:t>/)
})

test('separates Babae and Lalaki sheets with their Nagsasanay groups', async () => {
  const blob = await createMasterListAttendanceWordBlob({
    members: [member, tenor],
    trainees: [
      trainee('t-f', 'Faye', 'female'),
      trainee('t-m', 'Mario', 'male'),
    ],
    voices,
    dates: ['2026-10-17'],
    title: 'Attendance Sheet',
    groupByVoice: false,
    selectedVoiceIds: [],
    includeNagsasanayMen: true,
    includeNagsasanayWomen: true,
    separateChoirs: true,
    lastNameFirst: false,
    docFormat: DEFAULT_DOC_FORMAT,
    choir: 'aws',
    pangulongName: 'Maria Santos',
    filename: 'separated-attendance.docx',
  })

  const documentXml = await attendanceDocumentXml(blob)
  const text = [...documentXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(
    (match) => match[1],
  )
  const womenIndex = text.indexOf('Babae')
  const menIndex = text.indexOf('Lalaki')
  assert.ok(womenIndex > -1 && menIndex > womenIndex)
  assert.ok(text.indexOf('Nagsasanay Women') > womenIndex)
  assert.ok(text.indexOf('Nagsasanay Women') < menIndex)
  assert.ok(text.indexOf('Nagsasanay Men') > menIndex)
  // Two sheets, each with its own title block.
  assert.equal(
    documentXml.match(/<w:t[^>]*>Attendance Sheet<\/w:t>/g)?.length,
    2,
  )
  // The indicator is printed at 14 pt, larger than the date summary.
  assert.match(
    documentXml,
    /<w:sz w:val="28"\/>[\s\S]{0,400}<w:t[^>]*>Babae<\/w:t>/,
  )
  assert.match(
    documentXml,
    /<w:sz w:val="28"\/>[\s\S]{0,400}<w:t[^>]*>Lalaki<\/w:t>/,
  )
  // The date header pair sits in one compact 36 pt row.
  assert.match(documentXml, /<w:trHeight w:val="720" w:hRule="exact"\/>/)
})

test('a combined sheet prints no choir label under the dates', async () => {
  const blob = await createMasterListAttendanceWordBlob({
    members: [member, tenor],
    trainees: [],
    voices,
    dates: ['2026-10-17'],
    title: 'Attendance Sheet',
    groupByVoice: false,
    selectedVoiceIds: [],
    includeNagsasanayMen: false,
    includeNagsasanayWomen: false,
    separateChoirs: false,
    lastNameFirst: false,
    docFormat: DEFAULT_DOC_FORMAT,
    choir: 'aws',
    pangulongName: 'Maria Santos',
    filename: 'combined-attendance.docx',
  })

  const documentXml = await attendanceDocumentXml(blob)
  assert.doesNotMatch(documentXml, /<w:t[^>]*>Babae<\/w:t>/)
  assert.doesNotMatch(documentXml, /<w:t[^>]*>Lalaki<\/w:t>/)
})

test('prints the sheet title once and keeps the landscape page size correct', async () => {
  const roster = Array.from({ length: 60 }, (_, index) => ({
    ...member,
    id: `member-${index}`,
    firstName: `Singer${index}`,
  }))
  const blob = await createMasterListAttendanceWordBlob({
    members: roster,
    trainees: [],
    voices,
    dates: ['2026-10-17'],
    title: 'Attendance Sheet',
    groupByVoice: true,
    selectedVoiceIds: ['soprano'],
    includeNagsasanayMen: false,
    includeNagsasanayWomen: false,
    separateChoirs: false,
    lastNameFirst: false,
    docFormat: {
      ...DEFAULT_DOC_FORMAT,
      paperSize: 'letter',
      orientation: 'landscape',
    },
    choir: 'pnk',
    pangulongName: '',
    filename: 'landscape-attendance.docx',
  })

  const documentXml = await attendanceDocumentXml(blob)
  assert.equal(
    documentXml.match(/<w:t[^>]*>Attendance Sheet<\/w:t>/g)?.length,
    1,
  )
  assert.match(documentXml, /w:w="15840" w:h="12240" w:orient="landscape"/)
})
