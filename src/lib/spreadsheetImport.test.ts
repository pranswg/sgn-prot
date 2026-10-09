import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inflateRawSync } from 'node:zlib'

import {
  extractRosterFromSpreadsheet,
  isSpreadsheetFile,
  parseCsvText,
  rowsToCandidates,
  MEMBER_EXPORT_HEADERS,
  TRAINEE_EXPORT_HEADERS,
} from './spreadsheetImport'
import {
  createMasterListWordBlob,
  masterListToSpreadsheetRows,
  membersToRows,
  traineesToRows,
} from './export'
import type { VoicePosition } from '@/core/types/suguan'
import type { Member, Trainee } from '@/core/types/member'

const VOICES: VoicePosition[] = [
  { id: 'soprano-1', name: 'Soprano 1', shortName: 'S1', gender: 'female' },
  { id: 'soprano-2', name: 'Soprano 2', shortName: 'S2', gender: 'female' },
  { id: 'alto', name: 'Alto', shortName: 'A', gender: 'female' },
  { id: 'tenor', name: 'Tenor', shortName: 'T', gender: 'male' },
  { id: 'bass', name: 'Bass', shortName: 'B', gender: 'male' },
]

const EXISTING: Member[] = [
  {
    id: 'm1',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    gender: 'male',
    voicePosition: 'tenor',
    membershipType: 'regular',
    isActive: true,
    dateAdded: '2024-01-05',
    positions: ['oic'],
    notes: 'Existing',
  },
]

const TRAINEES: Trainee[] = [
  {
    id: 't1',
    firstName: 'Maria',
    lastName: 'Santos',
    gender: 'female',
    voicePosition: 'soprano-1',
    status: 'active',
    dateAdded: '2024-02-10',
  },
]

function matrixFromRows(rows: Record<string, string>[]): unknown[][] {
  const headers = Object.keys(rows[0])
  return [headers, ...rows.map((row) => headers.map((h) => row[h] ?? ''))]
}

function unzipEntries(bytes: Uint8Array): Map<string, Buffer> {
  const archive = Buffer.from(bytes)
  const entries = new Map<string, Buffer>()
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
    const localFileNameLength = archive.readUInt16LE(localHeaderOffset + 26)
    const localExtraLength = archive.readUInt16LE(localHeaderOffset + 28)
    const compressedDataStart =
      localHeaderOffset + 30 + localFileNameLength + localExtraLength
    const compressedData = archive.subarray(
      compressedDataStart,
      compressedDataStart + compressedSize,
    )
    entries.set(
      fileName,
      compression === 8 ? inflateRawSync(compressedData) : compressedData,
    )
    offset += 46 + fileNameLength + extraLength + commentLength
  }

  return entries
}

test('a member CSV export round-trips back into the same members', () => {
  const originals: Member[] = [
    {
      id: 'a',
      firstName: 'Ana',
      middleName: 'Marie',
      suffix: 'Jr.',
      lastName: 'Reyes',
      gender: 'female',
      voicePosition: 'alto',
      membershipType: 'organista',
      isActive: true,
      dateAdded: '2024-03-04',
      positions: ['kalihim-ng-mang-aawit'],
      notes: 'Plays the piano',
    },
    {
      id: 'b',
      firstName: 'Ben',
      lastName: 'Lim',
      gender: 'male',
      voicePosition: 'bass',
      membershipType: 'regular',
      isActive: false,
      dateAdded: '2023-11-12',
      positions: [],
      notes: '',
    },
  ]

  const exported = membersToRows(originals)
  const { candidates } = rowsToCandidates(
    matrixFromRows(exported as unknown as Record<string, string>[]),
    VOICES,
    [],
    [],
  )

  assert.equal(candidates.length, 2)

  const ana = candidates[0]
  assert.equal(ana.firstName, 'Ana')
  assert.equal(ana.middleName, 'Marie')
  assert.equal(ana.suffix, 'Jr.')
  assert.equal(ana.lastName, 'Reyes')
  assert.equal(ana.gender, 'female')
  assert.equal(ana.voicePosition, 'alto')
  assert.equal(ana.membershipType, 'organista')
  assert.equal(ana.isActive, true)
  assert.equal(ana.dateAdded, '2024-03-04')
  assert.deepEqual(ana.positions, ['kalihim-ng-mang-aawit', 'organista'])
  assert.equal(ana.notes, 'Plays the piano')
  assert.equal(ana.isTrainee, false)

  const ben = candidates[1]
  assert.equal(ben.voicePosition, 'bass')
  assert.equal(ben.membershipType, 'regular')
  assert.equal(ben.isActive, false)
  assert.deepEqual(ben.positions, [])
})

test('sectioned Master List exports re-import roster tables and merge leadership sections', () => {
  const headers = [
    'Blg.',
    'First Name',
    'Middle Name',
    'Last Name',
    'Suffix',
    'Gender',
    'Voice Position',
    'Positions / Privileges',
    'Duty Roles',
    'Membership Type',
    'Status',
    'Date Added',
    'Notes',
  ]
  const matrix = [
    ['MASTER LIST'],
    ['STA. MONICA CHOIR - Women'],
    headers,
    [
      '1.',
      'Rosa',
      '',
      'Villar',
      '',
      'Female',
      'Soprano 2',
      'Pangulong Mang-aawit',
      '',
      'Regular',
      'Active',
      '2024-07-07',
      '',
    ],
    ['STA. MONICA CHOIR - Pangulong Mang-aawit'],
    headers,
    [
      '1.',
      'Rosa',
      '',
      'Villar',
      '',
      'Female',
      'Soprano 2',
      'Pangulong Mang-aawit',
      'Pangulong Mang-aawit',
      'Regular',
      'Active',
      '2024-07-07',
      '',
    ],
    ['STA. MONICA CHOIR - Nagsasanay Women'],
    headers,
    [
      '1.',
      'Ana',
      '',
      'Reyes',
      '',
      'Female',
      'Alto',
      'Nagsasanay',
      '',
      '',
      'Active',
      '2024-08-01',
      '',
    ],
  ]
  const roles = [
    {
      id: 'pangulong-mang-aawit',
      name: 'Pangulong Mang-aawit',
      abbreviation: 'PM',
    },
  ]
  const { candidates, rowCount } = rowsToCandidates(
    matrix,
    VOICES,
    [],
    [],
    roles,
  )

  assert.equal(rowCount, 3)
  assert.equal(candidates.length, 2)
  const rosa = candidates.find((candidate) => candidate.firstName === 'Rosa')
  const ana = candidates.find((candidate) => candidate.firstName === 'Ana')
  assert.ok(rosa)
  assert.ok(ana)
  assert.equal(rosa.isTrainee, false)
  assert.deepEqual(rosa.assignedDutyRoleIds, ['pangulong-mang-aawit'])
  assert.equal(ana.isTrainee, true)
  assert.equal(ana.membershipType, undefined)
})

test('Master List spreadsheet export includes PDF-order sections and imports them', () => {
  const dutyRoles = [
    {
      id: 'custom-pangulong',
      name: 'Pangulong Mang-aawit',
      abbreviation: 'PM',
    },
  ]
  const members: Member[] = [
    {
      ...EXISTING[0],
      id: 'leader',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      assignedDutyRoleIds: ['custom-pangulong'],
    },
  ]
  const rows = masterListToSpreadsheetRows(
    members,
    TRAINEES,
    VOICES,
    dutyRoles,
    'Sta. Monica',
  )
  assert.deepEqual(rows[0], ['MASTER LIST'])
  assert.equal(
    rows.some((row) => row[0] === 'STA. MONICA CHOIR - Men'),
    true,
  )
  assert.equal(
    rows.some(
      (row) => row[0] === 'STA. MONICA CHOIR - Pangulong Mang-aawit',
    ),
    true,
  )
  assert.equal(
    rows.some(
      (row) => row[0] === 'STA. MONICA CHOIR - Nagsasanay Women',
    ),
    true,
  )

  const { candidates } = rowsToCandidates(rows, VOICES, [], [], dutyRoles)
  assert.equal(candidates.length, 2)
  const importedLeader = candidates.find(
    (candidate) => candidate.firstName === 'Juan',
  )
  const importedTrainee = candidates.find(
    (candidate) => candidate.firstName === 'Maria',
  )
  assert.ok(importedLeader)
  assert.ok(importedTrainee)
  assert.deepEqual(importedLeader.assignedDutyRoleIds, ['custom-pangulong'])
  assert.equal(importedTrainee.isTrainee, true)
})

test('Master List Word export matches PDF sections, styling, page breaks, and paper size', async () => {
  const leadershipMember: Member = {
    ...EXISTING[0],
    id: 'leader',
    firstName: 'Pedro',
    lastName: 'Santos',
    positions: ['pangulong-mang-aawit'],
  }
  const inactiveMember: Member = {
    ...EXISTING[0],
    id: 'inactive',
    firstName: 'Inactive',
    isActive: false,
  }
  const dutyRoles = [
    {
      id: 'pangulong-mang-aawit',
      name: 'Pangulong Mang-aawit',
      abbreviation: 'PMA',
    },
  ]
  const members = [...EXISTING, leadershipMember, inactiveMember]
  const blob = await createMasterListWordBlob(
    members,
    TRAINEES,
    VOICES,
    dutyRoles,
    'Sta. Monica',
    'legal',
  )
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  assert.ok(blob.size > 0)
  const entries = unzipEntries(new Uint8Array(await blob.arrayBuffer()))
  const document = entries.get('word/document.xml')?.toString('utf8') ?? ''
  const footer = entries.get('word/footer1.xml')?.toString('utf8') ?? ''

  assert.match(document, /MASTER LIST/)
  assert.match(document, /STA\. MONICA CHOIR - Women/)
  assert.match(document, /PANGULUHAN/)
  assert.match(document, /STA\. MONICA CHOIR - Pangulong Mang-aawit/)
  assert.match(document, /MASTER LIST SUMMARY/)
  assert.match(document, /Pangalan/)
  assert.match(document, /Position/)
  assert.match(document, /Segoe Script/)
  assert.match(document, /Book Antiqua/)
  assert.match(document, /F2F2F2/)
  assert.match(document, /166534/)
  assert.match(document, /B91C1C/)
  assert.equal((document.match(/w:pageBreakBefore/g) ?? []).length, 2)
  assert.match(document, /w:w="12240" w:h="20160"/)
  assert.match(footer, /As of/)
  assert.match(footer, /PAGE/)
  assert.match(footer, /NUMPAGES/)
  assert.doesNotMatch(footer, /w:pgNum/)
})

test('a trainee export is detected as trainees even though it has no membership column', () => {
  const exported = traineesToRows(TRAINEES)
  assert.ok(
    !TRAINEE_EXPORT_HEADERS.includes('Membership Type' as never),
    'trainee export must not carry a membership column',
  )

  const { candidates } = rowsToCandidates(
    matrixFromRows(exported as unknown as Record<string, string>[]),
    VOICES,
    [],
    [],
  )

  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].isTrainee, true)
  assert.equal(candidates[0].firstName, 'Maria')
  assert.equal(candidates[0].lastName, 'Santos')
  assert.equal(candidates[0].voicePosition, 'soprano-1')
  assert.equal(candidates[0].membershipType, undefined)
})

test('re-importing the same file marks every row as already in the list', () => {
  const exported = membersToRows([
    {
      ...EXISTING[0],
      notes: '',
    },
  ])
  const { candidates } = rowsToCandidates(
    matrixFromRows(exported as unknown as Record<string, string>[]),
    VOICES,
    EXISTING,
    TRAINEES,
  )

  assert.equal(candidates[0].duplicate, true)
  assert.equal(candidates[0].selected, false)
})

test('a legacy provisional membership folds into regular on import', () => {
  const { candidates } = rowsToCandidates(
    [
      [...MEMBER_EXPORT_HEADERS],
      ['A', 'One', '', '', 'Female', 'Alto', '—', 'Provisional', 'Active', '', ''],
    ],
    VOICES,
    [],
    [],
  )

  assert.equal(candidates[0].membershipType, 'regular')
})

test('duplicate rows within the same file are flagged after the first', () => {
  const { candidates } = rowsToCandidates(
    [
      [...MEMBER_EXPORT_HEADERS],
      ['Ana', 'Reyes', '', '', 'Female', 'Alto', '—', 'Regular', 'Active', '2024-01-01', ''],
      ['Ana', 'Reyes', '', '', 'Female', 'Soprano 1', '—', 'Regular', 'Active', '2024-01-01', ''],
    ],
    VOICES,
    [],
    [],
  )

  assert.equal(candidates.length, 2)
  assert.equal(candidates[0].duplicate, false)
  assert.equal(candidates[1].duplicate, true)
})

test('names are matched ignoring case, accents, and surrounding space', () => {
  const { candidates } = rowsToCandidates(
    [
      [...MEMBER_EXPORT_HEADERS],
      ['  juán ', '  dela cruz  ', '', '', 'Male', 'Tenor', '—', 'Regular', 'Active', '', ''],
    ],
    VOICES,
    EXISTING,
    [],
  )

  assert.equal(candidates[0].duplicate, true)
})

test('voice sections resolve by id, full name, and short name', () => {
  const { candidates } = rowsToCandidates(
    [
      [...MEMBER_EXPORT_HEADERS],
      ['A', 'One', '', '', 'Female', 'soprano-1', '—', 'Regular', 'Active', '', ''],
      ['B', 'Two', '', '', 'Female', 'Soprano 1', '—', 'Regular', 'Active', '', ''],
      ['C', 'Three', '', '', 'Female', 'S1', '—', 'Regular', 'Active', '', ''],
      ['D', 'Four', '', '', 'Male', 'Bass', '—', 'Regular', 'Active', '', ''],
    ],
    VOICES,
    [],
    [],
  )

  assert.deepEqual(
    candidates.map((c) => c.voicePosition),
    ['soprano-1', 'soprano-1', 'soprano-1', 'bass'],
  )
})

test('an unknown voice section falls back to the first section of that gender', () => {
  const { candidates } = rowsToCandidates(
    [
      [...MEMBER_EXPORT_HEADERS],
      ['A', 'One', '', '', 'Male', 'Baritone', '—', 'Regular', 'Active', '', ''],
    ],
    VOICES,
    [],
    [],
  )

  assert.equal(candidates[0].voicePosition, 'tenor')
})

test('gender accepts M and F as well as the full words', () => {
  const { candidates } = rowsToCandidates(
    [
      [...MEMBER_EXPORT_HEADERS],
      ['A', 'One', '', '', 'M', 'Tenor', '—', 'Regular', 'Active', '', ''],
      ['B', 'Two', '', '', 'f', 'Alto', '—', 'Regular', 'Active', '', ''],
    ],
    VOICES,
    [],
    [],
  )

  assert.deepEqual(
    candidates.map((c) => c.gender),
    ['male', 'female'],
  )
})

test('inactive and removed statuses both mark the row inactive', () => {
  const { candidates } = rowsToCandidates(
    [
      [...MEMBER_EXPORT_HEADERS],
      ['A', 'One', '', '', 'Female', 'Alto', '—', 'Regular', 'Inactive', '', ''],
      ['B', 'Two', '', '', 'Female', 'Alto', '—', 'Regular', 'Removed', '', ''],
      ['C', 'Three', '', '', 'Female', 'Alto', '—', 'Regular', '', '', ''],
    ],
    VOICES,
    [],
    [],
  )

  assert.deepEqual(
    candidates.map((c) => c.isActive),
    [false, false, true],
  )
})

test('a missing date leaves dateAdded undefined so the caller can default to today', () => {
  const { candidates } = rowsToCandidates(
    [
      [...MEMBER_EXPORT_HEADERS],
      ['A', 'One', '', '', 'Female', 'Alto', '—', 'Regular', 'Active', '', ''],
      ['B', 'Two', '', '', 'Female', 'Alto', '—', 'Regular', 'Active', 'not a date', ''],
    ],
    VOICES,
    [],
    [],
  )

  assert.equal(candidates[0].dateAdded, undefined)
  assert.equal(candidates[1].dateAdded, undefined)
})

test('an ISO timestamp is trimmed to its calendar date', () => {
  const { candidates } = rowsToCandidates(
    [
      [...MEMBER_EXPORT_HEADERS],
      ['A', 'One', '', '', 'Female', 'Alto', '—', 'Regular', 'Active', '2024-05-06T12:30:00.000Z', ''],
    ],
    VOICES,
    [],
    [],
  )

  assert.equal(candidates[0].dateAdded, '2024-05-06')
})

test('the em dash used for empty positions means no positions', () => {
  const { candidates } = rowsToCandidates(
    [
      [...MEMBER_EXPORT_HEADERS],
      ['A', 'One', '', '', 'Female', 'Alto', '—', 'Regular', 'Active', '', ''],
    ],
    VOICES,
    [],
    [],
  )

  assert.deepEqual(candidates[0].positions, [])
})

test('short position labels reverse back to their ids', () => {
  const { candidates } = rowsToCandidates(
    [
      [...MEMBER_EXPORT_HEADERS],
      ['A', 'One', '', '', 'Female', 'Alto', 'OIC, Kalihim', 'Regular', 'Active', '', ''],
    ],
    VOICES,
    [],
    [],
  )

  assert.deepEqual(candidates[0].positions, ['oic', 'kalihim-ng-mang-aawit'])
})

test('a "Last, First" cell is split when the columns are combined', () => {
  const { candidates } = rowsToCandidates(
    [
      ['Name', 'Gender', 'Voice Position'],
      ['Dela Cruz, Juan', 'Male', 'Tenor'],
    ],
    VOICES,
    [],
    [],
  )

  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].lastName, 'Dela Cruz')
  assert.equal(candidates[0].firstName, 'Juan')
})

test('a title row above the headers is skipped', () => {
  const { candidates } = rowsToCandidates(
    [
      ['STA. MONICA CHOIR — MASTER LIST'],
      ['Exported 2024-06-01'],
      [],
      [...MEMBER_EXPORT_HEADERS],
      ['A', 'One', '', '', 'Female', 'Alto', '—', 'Regular', 'Active', '2024-01-01', ''],
    ],
    VOICES,
    [],
    [],
  )

  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].lastName, 'One')
})

test('headers are matched regardless of case and punctuation', () => {
  const { candidates } = rowsToCandidates(
    [
      ['FIRST NAME', 'last_name', 'Gender', 'VoicePosition', 'Status'],
      ['A', 'One', 'Female', 'Alto', 'Active'],
    ],
    VOICES,
    [],
    [],
  )

  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].firstName, 'A')
  assert.equal(candidates[0].lastName, 'One')
  assert.equal(candidates[0].voicePosition, 'alto')
})

test('a sheet with no recognisable headers yields no candidates', () => {
  const { candidates } = rowsToCandidates(
    [['Random', 'Stuff'], ['1', '2']],
    VOICES,
    [],
    [],
  )

  assert.equal(candidates.length, 0)
})

test('blank rows are skipped and not counted', () => {
  const { candidates, rowCount } = rowsToCandidates(
    [
      [...MEMBER_EXPORT_HEADERS],
      ['A', 'One', '', '', 'Female', 'Alto', '—', 'Regular', 'Active', '', ''],
      ['', '', '', '', '', '', '', '', '', '', ''],
      ['B', 'Two', '', '', 'Female', 'Alto', '—', 'Regular', 'Active', '', ''],
    ],
    VOICES,
    [],
    [],
  )

  assert.equal(candidates.length, 2)
  assert.equal(rowCount, 2)
})

test('a row missing a name is skipped entirely', () => {
  const { candidates } = rowsToCandidates(
    [
      [...MEMBER_EXPORT_HEADERS],
      ['', 'One', '', '', 'Female', 'Alto', '—', 'Regular', 'Active', '', ''],
      ['B', '', '', '', 'Female', 'Alto', '—', 'Regular', 'Active', '', ''],
      ['C', 'Three', '', '', 'Female', 'Alto', '—', 'Regular', 'Active', '', ''],
    ],
    VOICES,
    [],
    [],
  )

  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].firstName, 'C')
})

test('a UTF-8 BOM and quoted commas keep the columns aligned', () => {
  const text =
    '\uFEFF"First Name","Last Name",Gender,"Voice Position","Positions / Privileges","Membership Type",Status,"Date Added",Notes\n' +
    '"Ana","Reyes, Santos","female","Soprano 1","—","Regular","Active","2024-02-02","note, with comma"\n'

  const matrix = parseCsvText(text)
  const { candidates } = rowsToCandidates(matrix, VOICES, [], [])

  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].firstName, 'Ana')
  assert.equal(candidates[0].lastName, 'Reyes, Santos')
  assert.equal(candidates[0].gender, 'female')
  assert.equal(candidates[0].voicePosition, 'soprano-1')
  assert.equal(candidates[0].notes, 'note, with comma')
})

test('isSpreadsheetFile accepts the exported extensions and rejects PDFs', () => {
  const make = (name: string) => new File(['x'], name)
  assert.equal(isSpreadsheetFile(make('master-list.csv')), true)
  assert.equal(isSpreadsheetFile(make('master-list.xlsx')), true)
  assert.equal(isSpreadsheetFile(make('MASTER-LIST.XLSM')), true)
  assert.equal(isSpreadsheetFile(make('roster.pdf')), false)
})

test('extractRosterFromSpreadsheet reads a CSV File end to end', async () => {
  const exported = membersToRows([
    {
      id: 'z',
      firstName: 'Rosa',
      lastName: 'Villar',
      gender: 'female',
      voicePosition: 'soprano-2',
      membershipType: 'regular',
      isActive: true,
      dateAdded: '2024-07-07',
      positions: ['pangulong-mang-aawit'],
      notes: '',
    },
  ])

  const row = exported[0] as unknown as Record<string, string>
  const text =
    [...MEMBER_EXPORT_HEADERS]
      .map((h) => `"${h}"`)
      .join(',') +
    '\n' +
    MEMBER_EXPORT_HEADERS.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`)
      .join(',') +
    '\n'

  const file = new File([text], 'master-list-all.csv', { type: 'text/csv' })
  const { candidates } = await extractRosterFromSpreadsheet(file, VOICES, [], [])

  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].firstName, 'Rosa')
  assert.equal(candidates[0].voicePosition, 'soprano-2')
  assert.deepEqual(candidates[0].positions, ['pangulong-mang-aawit'])
  assert.equal(candidates[0].dateAdded, '2024-07-07')
})
