import assert from 'node:assert/strict'
import test from 'node:test'
import type { VoicePosition } from '@/core/types/suguan'

import { memberPositionLabel } from './memberMembership.ts'

const VOICES: VoicePosition[] = [
  { id: 'soprano-2', name: 'Soprano 2', shortName: 'S2', gender: 'female' },
  { id: 'alto', name: 'Alto', shortName: 'A', gender: 'female' },
  { id: 'tenor', name: 'Tenor', shortName: 'T', gender: 'male' },
  { id: 'bass', name: 'Bass', shortName: 'B', gender: 'male' },
]

test('memberPositionLabel shows the voice name for a regular member', () => {
  assert.equal(
    memberPositionLabel(
      { membershipType: 'regular', voicePosition: 'soprano-2' },
      VOICES,
    ),
    'Soprano 2',
  )
})

test('memberPositionLabel shows the membership label for the organist family', () => {
  assert.equal(
    memberPositionLabel({ membershipType: 'organista', voicePosition: 'bass' }, VOICES),
    'Organista',
  )
  assert.equal(
    memberPositionLabel({ membershipType: 'tagapagturo', voicePosition: 'tenor' }, VOICES),
    'Tagapagturo',
  )
  assert.equal(
    memberPositionLabel({
      membershipType: 'assistant-tagapagturo',
      voicePosition: 'alto',
    }, VOICES),
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