import assert from 'node:assert/strict'
import test from 'node:test'

import { memberPositionLabel } from './memberMembership.ts'

test('memberPositionLabel shows the voice name for a regular member', () => {
  assert.equal(
    memberPositionLabel({ membershipType: 'regular', voicePosition: 'soprano-2' }),
    'Soprano 2',
  )
})

test('memberPositionLabel shows the membership label for the organist family', () => {
  assert.equal(
    memberPositionLabel({ membershipType: 'organista', voicePosition: 'bass' }),
    'Organista',
  )
  assert.equal(
    memberPositionLabel({ membershipType: 'tagapagturo', voicePosition: 'tenor' }),
    'Tagapagturo',
  )
  assert.equal(
    memberPositionLabel({
      membershipType: 'assistant-tagapagturo',
      voicePosition: 'alto',
    }),
    'Asst. Tagapagturo',
  )
})

test('memberPositionLabel honours a custom voices list', () => {
  assert.equal(
    memberPositionLabel(
      { membershipType: 'regular', voicePosition: 'tenor' },
      [
        { id: 'soprano-1', name: 'Soprano I', shortName: 'S1', gender: 'female' },
        { id: 'tenor', name: 'Tenor', shortName: 'T', gender: 'male' },
      ],
    ),
    'Tenor',
  )
})