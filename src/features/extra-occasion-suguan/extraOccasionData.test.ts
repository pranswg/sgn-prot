import assert from 'node:assert/strict'
import test from 'node:test'

import type { Member } from '@/core/types/member'
import type { Suguan } from '@/core/types/suguan'
import { normalizeSuguan } from '@/lib/suguanUtils'
import {
  buildExtraOccasionSections,
  memberIsEligibleExtraOrganista,
} from './extraOccasionData.ts'

const makeMember = (
  id: string,
  firstName: string,
  lastName: string,
  overrides: Partial<Member> = {},
): Member => ({
  id,
  firstName,
  lastName,
  gender: 'female',
  voicePosition: 'soprano-1',
  membershipType: 'regular',
  isActive: true,
  dateAdded: '2026-01-01',
  positions: [],
  ...overrides,
})

const suguan: Suguan = {
  id: 'extra',
  date: '',
  time: '',
  serviceTypeId: '',
  group: 'babae',
  events: [],
  schedules: [
    {
      id: 'schedule-1',
      scheduleLabel: 'Friday 3:00 PM',
      scheduleDay: 'Friday',
      scheduleTime: '3:00 PM',
      assignments: [
        {
          memberId: 'member-b',
          memberName: 'Kimberly Andao',
          voicePosition: 'soprano-1',
          assignedAt: '',
        },
        {
          memberId: 'member-a',
          memberName: 'Sarah Bautista',
          voicePosition: 'soprano-1',
          assignedAt: '',
        },
      ],
    },
  ],
  voiceCapacities: {},
  assignments: [],
  dutyRoles: [],
  createdAt: '',
  updatedAt: '',
}

test('Extra Occasion rows group by voice and sort members alphabetically', () => {
  const members = [
    makeMember('member-a', 'Sarah', 'Bautista'),
    makeMember('member-b', 'Kimberly', 'Andao'),
  ]

  const result = buildExtraOccasionSections(suguan, [
    { id: 'soprano-1', name: 'Soprano', shortName: 'S', gender: 'female' },
    { id: 'alto', name: 'Alto', shortName: 'A', gender: 'female' },
  ], members, {})

  assert.deepEqual(result[0].voiceSections, [
    {
      id: 'soprano-1',
      label: 'Soprano',
      rows: [
        { memberId: 'member-b', name: 'Andao, Kimberly' },
        { memberId: 'member-a', name: 'Bautista, Sarah' },
      ],
    },
  ])
})

test('Extra Occasion organista entries only include active organist-family members', () => {
  const organista = makeMember('organista', 'Kimberly', 'Andao', {
    membershipType: 'organista',
  })

  test('normalizing a saved Extra Occasion keeps custom settings and empty events', () => {
    const config = {
      localeName: 'Sta. Monica',
      pagsasanay: { enabled: true, label: 'Practice', date: '2026-02-10' },
      pagtupad: { enabled: false, label: 'Pagtupad', date: '' },
      showFooterSignatories: false,
      organistaAssignments: {
        'schedule-1': [{ memberId: 'organista', role: 'reserve' as const }],
      },
    }
    const result = normalizeSuguan(
      { ...suguan, date: '2026-02-10', extraOccasion: config },
      [{ id: 'soprano-1', gender: 'female' }],
    )

    assert.deepEqual(result.extraOccasion, config)
    assert.deepEqual(result.events, [])
  })
  const inactive = makeMember('inactive', 'Ana', 'Reyes', {
    membershipType: 'organista',
    isActive: false,
  })
  const ordinary = makeMember('ordinary', 'Ben', 'Cruz')

  assert.equal(memberIsEligibleExtraOrganista(organista), true)
  assert.equal(memberIsEligibleExtraOrganista(inactive), false)
  assert.equal(memberIsEligibleExtraOrganista(ordinary), false)
  assert.deepEqual(
    buildExtraOccasionSections(
      suguan,
      [],
      [organista, inactive, ordinary],
      { 'schedule-1': [{ memberId: organista.id, role: 'reserve' }] },
    )[0].organistaRows,
    [
      {
        memberId: 'organista',
        name: 'Andao, Kimberly - RESERBANG ORGANISTA',
      },
    ],
  )
})

test('Extra Occasion section label uses service type and time', () => {
  const members = [
    makeMember('member-b', 'Kimberly', 'Andao'),
    makeMember('member-a', 'Sarah', 'Bautista'),
  ]

  const withTime: Suguan = {
    ...suguan,
    schedules: [
      {
        ...suguan.schedules[0],
        scheduleLabel: 'Graduation Mass',
        scheduleTime: '10:00 AM',
      },
    ],
  }

  const result = buildExtraOccasionSections(withTime, [
    { id: 'soprano-1', name: 'Soprano', shortName: 'S', gender: 'female' },
  ], members, {})

  assert.equal(result[0].label, 'Graduation Mass · 10:00 AM')
})
