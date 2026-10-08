import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildServiceHeading,
  categoryLabel,
  createServiceFromSchedule,
  memberSubtitle,
  organistPrivilegeLabel,
  servicesFromCategories,
} from './organistaSuguanService.ts'
import { DEFAULT_SCHEDULE_CATEGORIES } from '@/core/constants/worshipSchedules'

test('category label names the two worship blocks', () => {
  assert.equal(categoryLabel('midweek'), 'Midweek Worship')
  assert.equal(categoryLabel('weekend'), 'Weekend Worship')
})

test('heading is the day and time the schedule was picked with', () => {
  assert.equal(buildServiceHeading('Miyerkules', '7:00 PM'), 'Miyerkules 7:00 PM')
})

test('createServiceFromSchedule snapshots the schedule into a card', () => {
  const schedule = DEFAULT_SCHEDULE_CATEGORIES.midweek[1]
  const service = createServiceFromSchedule(schedule, 'midweek')
  assert.ok(service.id)
  assert.equal(service.scheduleId, schedule.id)
  assert.equal(service.dayName, 'Huwebes')
  assert.equal(service.scheduleTime, '6:00 AM')
  assert.equal(service.categoryLabel, 'Midweek Worship')
  assert.equal(service.heading, 'Huwebes 6:00 AM')
  assert.equal(service.organist, '')
  assert.equal(service.reserve, '')
})

test('servicesFromCategories prefills one card per schedule, midweek first', () => {
  const services = servicesFromCategories(DEFAULT_SCHEDULE_CATEGORIES)
  assert.equal(services.length, 6)
  assert.deepEqual(
    services.map((s) => s.heading),
    [
      'Miyerkules 7:00 PM',
      'Huwebes 6:00 AM',
      'Huwebes 7:00 PM',
      'Sabado 6:00 PM',
      'Linggo 6:00 AM',
      'Linggo 10:00 AM',
    ],
  )
})

test('servicesFromCategories starts empty when every schedule is disabled', () => {
  const services = servicesFromCategories({ midweek: [], weekend: [] })
  assert.deepEqual(services, [])
})

test('organistPrivilegeLabel uses the membership label for organist-family members', () => {
  const member = {
    membershipType: 'assistant-tagapagturo' as const,
    positions: [],
  }
  assert.equal(
    organistPrivilegeLabel(member),
    'Assistant Tagapagturo ng Awit',
  )
})

test('organistPrivilegeLabel falls back to the stored position for legacy members', () => {
  assert.equal(
    organistPrivilegeLabel({ membershipType: 'regular', positions: ['organista'] }),
    'Organista',
  )
  assert.equal(
    organistPrivilegeLabel({
      membershipType: 'regular',
      positions: ['assistant-tagapagturo'],
    }),
    'Assistant Tagapagturo',
  )
  assert.equal(
    organistPrivilegeLabel({ membershipType: 'regular', positions: [] }),
    '',
  )
})

test('memberSubtitle joins voice and privilege, omitting each when absent', () => {
  assert.equal(
    memberSubtitle(
      { membershipType: 'organista', positions: [], voicePosition: 'soprano-1' },
    ),
    'Soprano 1 · Organista',
  )
  assert.equal(
    memberSubtitle(
      { membershipType: 'organista', positions: [], voicePosition: '' },
    ),
    'Organista',
  )
  assert.equal(
    memberSubtitle(
      { membershipType: 'regular', positions: ['organista'], voicePosition: 'tenor' },
    ),
    'Tenor · Organista',
  )
})

test('memberSubtitle hides the placeholder voice for unassigned voices', () => {
  assert.equal(
    memberSubtitle(
      { membershipType: 'organista', positions: [], voicePosition: 'unassigned' },
    ),
    'Organista',
  )
})