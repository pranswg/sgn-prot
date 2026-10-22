/**
 * The choir split is the whole PNK feature: every list reads through these
 * helpers, so a regression here would leak one choir into the other's screens.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import type { Member, Trainee } from '@/core/types/member'
import { CHOIR_LABELS, choirOf, membersOf, pnkVoicePositionId, traineesOf } from './choirs.ts'

function member(id: string, choir?: 'aws' | 'pnk'): Member {
  return {
    id,
    firstName: id,
    lastName: 'Test',
    gender: 'female',
    voicePosition: 'soprano-1',
    membershipType: 'regular',
    isActive: true,
    dateAdded: '2026-10-01',
    choir,
    positions: [],
    history: [],
  }
}

function trainee(id: string, choir?: 'aws' | 'pnk'): Trainee {
  return {
    id,
    firstName: id,
    lastName: 'Test',
    gender: 'female',
    voicePosition: 'soprano-1',
    status: 'active',
    dateAdded: '2026-10-01',
    choir,
  }
}

test('a record without a choir is AWS', () => {
  // Every member saved before store version 8 has no field at all.
  assert.equal(choirOf(undefined), 'aws')
  assert.equal(choirOf({}), 'aws')
  assert.equal(choirOf({ choir: 'aws' }), 'aws')
  assert.equal(choirOf({ choir: 'pnk' }), 'pnk')
})

test('each choir reads only its own members', () => {
  const members = [member('aws-1'), member('legacy'), member('pnk-1', 'pnk')]

  assert.deepEqual(
    membersOf(members, 'aws').map((m) => m.id),
    ['aws-1', 'legacy'],
  )
  assert.deepEqual(
    membersOf(members, 'pnk').map((m) => m.id),
    ['pnk-1'],
  )
  // A PNK-only roster is empty, not the AWS list.
  assert.deepEqual(membersOf([member('aws-1')], 'pnk'), [])
})

test('each choir reads only its own trainees', () => {
  const trainees = [trainee('t-aws'), trainee('t-pnk', 'pnk')]

  assert.deepEqual(
    traineesOf(trainees, 'aws').map((t) => t.id),
    ['t-aws'],
  )
  assert.deepEqual(
    traineesOf(trainees, 'pnk').map((t) => t.id),
    ['t-pnk'],
  )
})

test('the choir labels are the short names used in titles and filenames', () => {
  assert.equal(CHOIR_LABELS.aws, 'AWS')
  assert.equal(CHOIR_LABELS.pnk, 'PNK')
})

test('PNK saves the configured Soprano 2 position, whatever its id', () => {
  // Roles configured in Settings carry generated ids, so it resolves by name.
  assert.equal(
    pnkVoicePositionId([
      { id: 'v_1', name: 'Alto' },
      { id: 'v_2', name: 'SOPRANO 1' },
      { id: 'v_3', name: 'Soprano 2' },
    ]),
    'v_3',
  )

  // Without a Soprano 2 entry, retain a configured soprano if possible.
  assert.equal(
    pnkVoicePositionId([
      { id: 'v_1', name: 'Alto' },
      { id: 'v_2', name: 'Soprano 1' },
      { id: 'v_3', name: 'Tenor' },
    ]),
    'v_2',
  )

  // And with no voices configured at all it falls back to the standard id.
  assert.equal(pnkVoicePositionId([]), 'soprano-2')
})
