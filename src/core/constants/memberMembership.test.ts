import assert from 'node:assert/strict'
import test from 'node:test'
import type { VoicePosition } from '@/core/types/suguan'
import type { DutyRole } from '@/core/types/suguan'

import { memberIsOrganist, memberPositionLabel } from './memberMembership.ts'

const VOICES: VoicePosition[] = [
  { id: 'soprano-2', name: 'Soprano 2', shortName: 'S2', gender: 'female' },
  { id: 'alto', name: 'Alto', shortName: 'A', gender: 'female' },
  { id: 'tenor', name: 'Tenor', shortName: 'T', gender: 'male' },
  { id: 'bass', name: 'Bass', shortName: 'B', gender: 'male' },
]

/** The ids are the shape the store holds (nanoid), not the old fixed ids. */
const DUTY_ROLES: DutyRole[] = [
  { id: 'zTudCx73-YMHh0PCdbjs2', name: 'Organista', abbreviation: 'ORG' },
  {
    id: 'Ccuo8FLgJo4lgfK19ildr',
    name: 'Pangulong Mang-aawit',
    abbreviation: 'PM',
  },
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

test('memberIsOrganist accepts the organist-family memberships', () => {
  assert.equal(memberIsOrganist({ membershipType: 'organista' }), true)
  assert.equal(memberIsOrganist({ membershipType: 'tagapagturo' }), true)
  assert.equal(
    memberIsOrganist({ membershipType: 'assistant-tagapagturo' }),
    true,
  )
  assert.equal(memberIsOrganist({ membershipType: 'regular' }), false)
})

test('memberIsOrganist accepts a legacy stored Organista position', () => {
  assert.equal(
    memberIsOrganist({ membershipType: 'regular', positions: ['organista'] }),
    true,
  )
})

test('memberIsOrganist accepts a member ranked with the configured Organista role', () => {
  // A plain "Mang-aawit" the administrator ranked as Organista in the
  // directory belongs on the Organist Suguan lists too.
  const ranked = {
    membershipType: 'regular' as const,
    positions: [],
    assignedDutyRoleIds: ['zTudCx73-YMHh0PCdbjs2'],
  }
  assert.equal(memberIsOrganist(ranked, DUTY_ROLES), true)
  // Without the configured roles there is nothing to match the id against.
  assert.equal(memberIsOrganist(ranked), false)
  // A rank that is not Organista does not make an organist.
  assert.equal(
    memberIsOrganist(
      {
        membershipType: 'regular',
        positions: [],
        assignedDutyRoleIds: ['Ccuo8FLgJo4lgfK19ildr'],
      },
      DUTY_ROLES,
    ),
    false,
  )
})