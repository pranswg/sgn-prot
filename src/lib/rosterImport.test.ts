/**
 * Roster PDF parser tests.
 *
 * `parseRosterPages` is pure: it takes positioned text items and returns
 * candidates, so it can be exercised without a PDF or a DOM. Each page is given
 * as text items with `x`/`y`, mirroring what `extractRosterFromPdf` hands it.
 *
 * The parser is a heuristic over scanned-style roster output, so these tests pin
 * the behaviour it deliberately has: forgiving name splitting, role suffixes
 * lifted into notes, and duplicate detection that also sees the existing
 * Master List.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import type { Member, Trainee } from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'
import {
  normalizeNameKey,
  parseRosterPages,
  type ExtractedTextItem,
} from './rosterImport.ts'

const VOICES: VoicePosition[] = [
  { id: 'soprano-1', name: 'Soprano I', shortName: 'S1', gender: 'female' },
  { id: 'soprano-2', name: 'Soprano II', shortName: 'S2', gender: 'female' },
  { id: 'alto', name: 'Alto', shortName: 'A', gender: 'female' },
  { id: 'tenor', name: 'Tenor', shortName: 'T', gender: 'male' },
  { id: 'bass', name: 'Bass', shortName: 'B', gender: 'male' },
]

function member(over: Partial<Member> & { firstName: string; lastName: string }): Member {
  return {
    id: `m-${over.firstName}-${over.lastName}`,
    gender: 'female',
    voicePosition: 'soprano-1',
    membershipType: 'regular',
    isActive: true,
    dateAdded: '2026-01-01',
    positions: [],
    ...over,
  }
}

function trainee(over: Partial<Trainee> & { firstName: string; lastName: string }): Trainee {
  return {
    id: `t-${over.firstName}-${over.lastName}`,
    gender: 'female',
    voicePosition: 'soprano-1',
    status: 'active',
    dateAdded: '2026-01-01',
    ...over,
  }
}

/** Builds a single left-hand column page from top-to-bottom lines. */
function page(...lines: string[]): ExtractedTextItem[] {
  return lines.map((str, index) => ({
    x: 40,
    y: 700 - index * 14,
    str,
  }))
}

function parse(
  pages: ExtractedTextItem[][],
  members: Member[] = [],
  trainees: Trainee[] = [],
) {
  return parseRosterPages(pages, VOICES, members, trainees)
}

test('reads a comma-form name under a voice heading', () => {
  const candidates = parse([
    page(
      'SOPRANO I',
      'Daco, Sandreah Rose',
      'Reyes, Maria Clara',
    ),
  ])

  assert.equal(candidates.length, 2)
  assert.equal(candidates[0].firstName, 'Sandreah Rose')
  assert.equal(candidates[0].lastName, 'Daco')
  assert.equal(candidates[0].voicePosition, 'soprano-1')
  assert.equal(candidates[0].gender, 'female')
  assert.equal(candidates[0].isTrainee, false)
  assert.equal(candidates[0].isActive, true)
})

test('matches voice headings case-insensitively and resolves gender', () => {
  const candidates = parse([page('BASS', 'Santos, Juan Pedro')])
  assert.equal(candidates[0].voicePosition, 'bass')
  assert.equal(candidates[0].gender, 'male')
})

test('surname particles are not treated as the first name', () => {
  const candidates = parse([page('ALTO', 'Maria Dela Cruz')])
  assert.equal(candidates[0].firstName, 'Maria')
  assert.equal(candidates[0].lastName, 'Dela Cruz')
})

test('drops numbering, status tokens, and a stray single-letter initial', () => {
  const candidates = parse([
    page('SOPRANO I', '1. Dalendeg, Lyka D. ACTIVE'),
  ])
  assert.equal(candidates[0].lastName, 'Dalendeg')
  // A middle-name initial is dropped along with the stray marker letters; the
  // roster's role column also emits single letters, so they cannot be told apart.
  assert.equal(candidates[0].firstName, 'Lyka')
  assert.equal(candidates[0].isActive, true)
})

test('INACTIVE marks the row as inactive', () => {
  const candidates = parse([page('SOPRANO I', 'Cruz, Ana INACTIVE')])
  assert.equal(candidates[0].isActive, false)
})

test('Balik-Tungkulin is lifted into notes rather than the name', () => {
  const candidates = parse([page('SOPRANO I', 'Lim, Jose BALIK-TUNGKULIN')])
  assert.equal(candidates[0].firstName, 'Jose')
  // `cleanNote` flattens hyphens, dashes, and en/em dashes to spaces.
  assert.equal(candidates[0].notes, 'Balik Tungkulin')
})

test('trainee sections mark rows as trainees and take gender from the heading', () => {
  const candidates = parse([
    page(
      'NAGSASANAY BABAE',
      'Nepomoceno, Rosa',
      'NAGSASANAY LALAKI',
      'Bautista, Rafael',
    ),
  ])

  assert.equal(candidates[0].isTrainee, true)
  assert.equal(candidates[0].gender, 'female')
  assert.equal(candidates[1].isTrainee, true)
  assert.equal(candidates[1].gender, 'male')
})

test('leader sections split the role off the given name into notes', () => {
  const candidates = parse([page('PANGULUHAN', 'Dela Cruz, Juan KALIHIM')])

  assert.equal(candidates[0].firstName, 'Juan')
  assert.equal(candidates[0].lastName, 'Dela Cruz')
  assert.ok(candidates[0].notes.includes('KALIHIM'))
})

test('known bug: a row whose role marker is also a banned token is dropped entirely', () => {
  // `looksLikeName` rejects any line containing a BANNED_NAME_TOKENS entry, and
  // 10 of the 11 ROLE_MARKERS are in that set (PANGULONG, ORGANISTA, LEAD, OIC,
  // ...). The rejection happens before `stripRoleSuffix` runs, so the leader's
  // role-splitting path is unreachable for those markers and the row is lost
  // rather than imported with the role in notes.
  //
  // Pinned here so the behaviour is visible. Fixing it means letting the
  // leaders/organista sections bypass the banned-token check, since there the
  // trailing uppercase word is known to be a role, not a column header.
  const candidates = parse([page('PANGULUHAN', 'Dela Cruz, Juan PANGULONG')])
  assert.equal(candidates.length, 0)
})

test('lines before any heading are ignored', () => {
  const candidates = parse([page('CHORAL PRESENTS', 'NAMEDROSTER', 'ALTO', 'Ramos, Bea')])
  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].lastName, 'Ramos')
})

test('an existing trainee is treated as a duplicate too', () => {
  const existing = [trainee({ firstName: 'Rosa', lastName: 'Nepomoceno' })]
  const candidates = parse(
    [page('NAGSASANAY BABAE', 'Nepomoceno, Rosa')],
    [],
    existing,
  )
  assert.equal(candidates[0].duplicate, true)
  assert.equal(candidates[0].selected, false)
})

test('flags a duplicate against the existing Master List and leaves it unselected', () => {
  const existing = [member({ firstName: 'Maria Clara', lastName: 'Reyes' })]
  const candidates = parse([page('SOPRANO I', 'Reyes, Maria Clara')], existing)

  assert.equal(candidates[0].duplicate, true)
  assert.equal(candidates[0].selected, false)
})

test('flags a duplicate within the parsed roster itself', () => {
  const candidates = parse([page('SOPRANO I', 'Reyes, Maria Clara', 'Reyes, Maria Clara')])
  assert.equal(candidates[0].duplicate, false)
  assert.equal(candidates[0].selected, true)
  assert.equal(candidates[1].duplicate, true)
  assert.equal(candidates[1].selected, false)
})

test('duplicate detection ignores case and diacritics', () => {
  const existing = [member({ firstName: 'Jose', lastName: 'Núñez' })]
  const candidates = parse([page('SOPRANO I', 'Nunez, Jose')], existing)
  assert.equal(candidates[0].duplicate, true)
})

test('normalizeNameKey ignores case and diacritics', () => {
  assert.equal(normalizeNameKey('Núñez', 'Jose'), normalizeNameKey('NUNEZ', 'Jose'))
  assert.notEqual(normalizeNameKey('Reyes', 'Maria'), normalizeNameKey('Reyes', 'Ana'))
})

test('known limitation: whitespace padding on one name half is not normalised', () => {
  // `.trim()` runs once on the joined `last|first` string, so padding on the
  // first-name half survives as an interior space. Two candidates that differ
  // only by padded whitespace would not match as duplicates. Callers currently
  // split names from whitespace-filtered tokens, so this stays latent.
  assert.notEqual(normalizeNameKey('NUNEZ', 'JOSE'), normalizeNameKey('NUNEZ', ' JOSE '))
})

test('splits a two-column page into independent rows', () => {
  const left: ExtractedTextItem[] = [
    { x: 40, y: 700, str: 'SOPRANO I' },
    { x: 40, y: 686, str: 'Reyes, Maria Clara' },
  ]
  const right: ExtractedTextItem[] = [
    { x: 420, y: 700, str: 'Reyes, Maria Clara' },
  ]
  const candidates = parse([[...left, ...right]])

  assert.equal(candidates.length, 2)
  assert.ok(candidates.every((c) => c.voicePosition === 'soprano-1'))
})