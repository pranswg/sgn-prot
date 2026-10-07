import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  extractRosterFromSpreadsheet,
  isSpreadsheetFile,
  parseCsvText,
  rowsToCandidates,
  MEMBER_EXPORT_HEADERS,
  TRAINEE_EXPORT_HEADERS,
} from './spreadsheetImport'
import { membersToRows, traineesToRows } from './export'
import { DEFAULT_VOICE_POSITIONS } from '@/core/constants/voicePositions'
import type { Member, Trainee } from '@/core/types/member'

const VOICES = DEFAULT_VOICE_POSITIONS

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

test('a member CSV export round-trips back into the same members', () => {
  const originals: Member[] = [
    {
      id: 'a',
      firstName: 'Ana',
      middleName: 'Marie',
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
      ['A', 'One', '', 'Female', 'Alto', '—', 'Provisional', 'Active', '', ''],
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
      ['Ana', 'Reyes', '', 'Female', 'Alto', '—', 'Regular', 'Active', '2024-01-01', ''],
      ['Ana', 'Reyes', '', 'Female', 'Soprano 1', '—', 'Regular', 'Active', '2024-01-01', ''],
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
      ['  juán ', '  dela cruz  ', '', 'Male', 'Tenor', '—', 'Regular', 'Active', '', ''],
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
      ['A', 'One', '', 'Female', 'soprano-1', '—', 'Regular', 'Active', '', ''],
      ['B', 'Two', '', 'Female', 'Soprano 1', '—', 'Regular', 'Active', '', ''],
      ['C', 'Three', '', 'Female', 'S1', '—', 'Regular', 'Active', '', ''],
      ['D', 'Four', '', 'Male', 'Bass', '—', 'Regular', 'Active', '', ''],
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
      ['A', 'One', '', 'Male', 'Baritone', '—', 'Regular', 'Active', '', ''],
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
      ['A', 'One', '', 'M', 'Tenor', '—', 'Regular', 'Active', '', ''],
      ['B', 'Two', '', 'f', 'Alto', '—', 'Regular', 'Active', '', ''],
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
      ['A', 'One', '', 'Female', 'Alto', '—', 'Regular', 'Inactive', '', ''],
      ['B', 'Two', '', 'Female', 'Alto', '—', 'Regular', 'Removed', '', ''],
      ['C', 'Three', '', 'Female', 'Alto', '—', 'Regular', '', '', ''],
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
      ['A', 'One', '', 'Female', 'Alto', '—', 'Regular', 'Active', '', ''],
      ['B', 'Two', '', 'Female', 'Alto', '—', 'Regular', 'Active', 'not a date', ''],
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
      ['A', 'One', '', 'Female', 'Alto', '—', 'Regular', 'Active', '2024-05-06T12:30:00.000Z', ''],
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
      ['A', 'One', '', 'Female', 'Alto', '—', 'Regular', 'Active', '', ''],
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
      ['A', 'One', '', 'Female', 'Alto', 'OIC, Kalihim', 'Regular', 'Active', '', ''],
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
      ['A', 'One', '', 'Female', 'Alto', '—', 'Regular', 'Active', '2024-01-01', ''],
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
      ['A', 'One', '', 'Female', 'Alto', '—', 'Regular', 'Active', '', ''],
      ['', '', '', '', '', '', '', '', '', ''],
      ['B', 'Two', '', 'Female', 'Alto', '—', 'Regular', 'Active', '', ''],
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
      ['', 'One', '', 'Female', 'Alto', '—', 'Regular', 'Active', '', ''],
      ['B', '', '', 'Female', 'Alto', '—', 'Regular', 'Active', '', ''],
      ['C', 'Three', '', 'Female', 'Alto', '—', 'Regular', 'Active', '', ''],
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
