import assert from 'node:assert/strict'
import test from 'node:test'
import { inflateRawSync } from 'node:zlib'
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
    const documentXml = await attendanceDocumentXml(blob)
    assert.match(documentXml, /<w:t[^>]*>10\/17\/2026<\/w:t>[\s\S]*<w:t[^>]*>Lagda<\/w:t>/)
    assert.match(documentXml, /<w:t[^>]*>Lagda<\/w:t>/)
  })

  assert.ok(blob.size > 0)
  const documentXml = await attendanceDocumentXml(blob)
  assert.match(documentXml, /<w:t[^>]*>10\/17\/2026<\/w:t>[\s\S]*<w:t[^>]*>Lagda<\/w:t>/)
  assert.match(documentXml, /<w:t[^>]*>Lagda<\/w:t>/)
  assert.equal(
    blob.type,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  )
})
