/**
 * Date-planning tests.
 *
 * These deliberately use only relative imports so Node can load them directly,
 * with no bundler or path-alias resolution involved. Run under several `TZ`
 * values to prove the results never depend on the device timezone:
 *
 *   node --test src/lib/suguanDates.test.ts
 *   TZ=America/New_York node --test src/lib/suguanDates.test.ts
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  addDays,
  dayOfMonthKey,

  earlierDateKey,
  firstDateKey,
  formatDateKey,
  formatDateKeyLong,
  formatDateKeyNumeric,
  isDateKey,
  isPastPHT,
  laterDateKey,
  monthShortKey,
  nextDateOnWeekdays,
  phtInstantISO,
  phtStampForFilename,
  toDateKeyFromInstant,
  todayPHT,
  weekdayOf,
} from './phDate.ts'
import {
  ALL_WORSHIP_SCHEDULES,
  DEFAULT_SCHEDULE_CATEGORIES,
  MIDWEEK_SCHEDULES,
  WEEKEND_SCHEDULES,
  isWorshipWeekday,
  worshipWeekdays,
  type WorshipSchedule,
  type WorshipScheduleCategories,
} from '../core/constants/worshipSchedules.ts'
import {
  nextWorshipBlock,
  nextWorshipDateKey,
  planEventsFromCoverage,
  schedulesForTemplate,
  suggestPagtupadBlock,
  worshipWeekFromRehearsal,
  worshipWeekSchedules,
} from './suguanDates.ts'

const WEDNESDAY = 3
const THURSDAY = 4
const FRIDAY = 5
const SATURDAY = 6
const SUNDAY = 0

test('weekdayOf reads the real weekday regardless of device timezone', () => {
  assert.equal(weekdayOf('2026-09-26'), SATURDAY)
  assert.equal(weekdayOf('2026-09-30'), WEDNESDAY)
  assert.equal(weekdayOf('2026-10-04'), SUNDAY)
  assert.equal(weekdayOf('2026-01-01'), THURSDAY)
})

test('the reported off-by-one bug is gone: Saturday + 4 days is Wednesday', () => {
  // Previously: parseISO('2026-09-26').toISOString().slice(0, 10) === '2026-09-29'
  const saturday = '2026-09-26'
  assert.equal(addDays(saturday, 4), '2026-09-30')
  assert.equal(weekdayOf(addDays(saturday, 4)), WEDNESDAY)
  assert.notEqual(addDays(saturday, 4), '2026-09-29')
})

test('addDays crosses month and year boundaries', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01')
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
  assert.equal(addDays('2024-03-01', -1), '2024-02-29') // leap year
  assert.equal(addDays('2026-09-30', 0), '2026-09-30')
})

test('isDateKey rejects malformed and non-padded values', () => {
  assert.equal(isDateKey('2026-09-26'), true)
  assert.equal(isDateKey('2026-9-26'), false)
  assert.equal(isDateKey('2026-13-01'), false)
  assert.equal(isDateKey('2026-02-30'), false)
  assert.equal(isDateKey(''), false)
  assert.equal(isDateKey(undefined), false)
  assert.equal(isDateKey('not a date'), false)
})

test('formatting a key is stable and never shifts a day', () => {
  assert.equal(formatDateKey('2026-09-26'), 'Sep 26, 2026')
  assert.equal(formatDateKeyLong('2026-09-26'), 'Saturday, September 26, 2026')
  assert.equal(formatDateKeyNumeric('2026-09-26'), '09/26/2026')
  assert.equal(dayOfMonthKey('2026-09-26'), '26')
  assert.equal(monthShortKey('2026-09-26'), 'Sep')
  // A midnight-boundary key must not render as the previous day.
  assert.equal(dayOfMonthKey('2026-10-01'), '1')
  assert.equal(formatDateKey('2026-10-01'), 'Oct 1, 2026')
})

test('invalid keys degrade instead of throwing', () => {
  assert.equal(formatDateKey('nope'), '—')
  assert.equal(formatDateKeyLong(''), '—')
  assert.equal(dayOfMonthKey('nope'), '—')
})

test('todayPHT uses the Philippine calendar day, not the device one', () => {
  // 2026-09-30 16:30 UTC is already 2026-10-01 00:30 in Manila.
  const instant = new Date('2026-09-30T16:30:00Z')
  assert.equal(toDateKeyFromInstant(instant), '2026-10-01')
  assert.equal(todayPHT(instant), '2026-10-01')
  // 2026-09-30 15:30 UTC is still 2026-09-30 23:30 in Manila.
  const justBefore = new Date('2026-09-30T15:30:00Z')
  assert.equal(todayPHT(justBefore), '2026-09-30')
})

test('isPastPHT treats today as not past', () => {
  const instant = new Date('2026-09-30T16:30:00Z') // 00:30 on Oct 1 in Manila
  assert.equal(isPastPHT('2026-10-01', instant), false)
  assert.equal(isPastPHT('2026-09-30', instant), true)
  assert.equal(isPastPHT('2026-10-02', instant), false)
})

test('laterDateKey picks the greatest of the valid values', () => {
  assert.equal(laterDateKey('2026-10-04', '2026-10-03', '2026-10-01'), '2026-10-04')
  assert.equal(laterDateKey('2026-10-03', '2026-10-04', '2026-10-01'), '2026-10-04')
  assert.equal(laterDateKey('2026-10-04', '2026-10-04', '2026-10-01'), '2026-10-04')
  assert.equal(laterDateKey(undefined, '2026-10-03', '2026-10-01'), '2026-10-03')
  assert.equal(laterDateKey('2026-10-02', undefined, '2026-10-01'), '2026-10-02')
  // Never leaks `undefined` into a persisted date field.
  assert.equal(laterDateKey(undefined, undefined, undefined), '')
})

test('earlierDateKey picks the smallest of the valid values', () => {
  assert.equal(earlierDateKey('2026-10-04', '2026-10-03', '2026-10-01'), '2026-10-03')
  assert.equal(earlierDateKey('2026-10-03', '2026-10-04', '2026-10-01'), '2026-10-03')
  assert.equal(earlierDateKey(undefined, undefined, undefined), '')
})

test('firstDateKey lets an explicit entry outrank a later default', () => {
  assert.equal(firstDateKey('2026-10-03', '2026-10-01'), '2026-10-03')
  assert.equal(firstDateKey(undefined, '2026-10-01'), '2026-10-01')
  assert.equal(firstDateKey('', 'nope', '2026-10-01'), '2026-10-01')
  assert.equal(firstDateKey(undefined, undefined), '')
})

test('PHT instant and filename stamps state Philippine time explicitly', () => {
  const instant = new Date('2026-09-30T16:30:00Z')
  assert.equal(phtInstantISO(instant), '2026-10-01T00:30:00+08:00')
  assert.equal(phtStampForFilename(instant), '2026-10-01-0030')
})

test('the configured worship days are the real choir schedule', () => {
  const all = worshipWeekdays(ALL_WORSHIP_SCHEDULES)
  assert.deepEqual([...all].sort(), [WEDNESDAY, THURSDAY, SATURDAY, SUNDAY].sort())
  assert.deepEqual(
    [...worshipWeekdays(MIDWEEK_SCHEDULES)].sort(),
    [WEDNESDAY, THURSDAY].sort(),
  )
  assert.deepEqual(
    [...worshipWeekdays(WEEKEND_SCHEDULES)].sort(),
    [SATURDAY, SUNDAY].sort(),
  )
  assert.equal(isWorshipWeekday(FRIDAY), false)
  assert.equal(isWorshipWeekday(SATURDAY), true)
})

test('nextDateOnWeekdays is strictly after the given day', () => {
  const worship = [WEDNESDAY, THURSDAY, SATURDAY, SUNDAY]
  // A rehearsal ON a worship day still moves to a later one.
  assert.equal(nextDateOnWeekdays('2026-09-30', worship), '2026-10-01')
  assert.equal(nextDateOnWeekdays('2026-10-01', worship), '2026-10-03')
  assert.equal(nextDateOnWeekdays('2026-10-02', worship), '2026-10-03')
  assert.equal(nextDateOnWeekdays('2026-10-03', worship), '2026-10-04')
  assert.equal(nextDateOnWeekdays('2026-10-04', worship), '2026-10-07')
  assert.equal(nextDateOnWeekdays('2026-10-05', worship), '2026-10-07')
  // Wraps across a month boundary.
  assert.equal(nextDateOnWeekdays('2026-10-31', worship), '2026-11-01')
  assert.equal(nextDateOnWeekdays('2026-12-31', worship), '2027-01-02')
})

// --- Worship blocks ---------------------------------------------------------
//
// The Pagtupad is never a single day: midweek is Wednesday AND Thursday,
// weekend is Saturday AND Sunday.

const MIDWEEK_DAYS = worshipWeekdays(MIDWEEK_SCHEDULES)
const WEEKEND_DAYS = worshipWeekdays(WEEKEND_SCHEDULES)

test('nextWorshipBlock returns a two-day midweek block', () => {
  // A Saturday rehearsal lands on the following Wednesday–Thursday.
  assert.deepEqual(nextWorshipBlock('2026-09-26', MIDWEEK_DAYS), {
    start: '2026-09-30',
    end: '2026-10-01',
    days: [WEDNESDAY, THURSDAY],
  })
  // A Sunday rehearsal takes the very next midweek.
  assert.deepEqual(nextWorshipBlock('2026-09-27', MIDWEEK_DAYS), {
    start: '2026-09-30',
    end: '2026-10-01',
    days: [WEDNESDAY, THURSDAY],
  })
})

test('nextWorshipBlock returns a two-day weekend block', () => {
  // Saturday rehearsal serves that same weekend.
  assert.deepEqual(nextWorshipBlock('2026-10-03', WEEKEND_DAYS), {
    start: '2026-10-03',
    end: '2026-10-04',
    days: [SATURDAY, SUNDAY],
  })
  // A Wednesday rehearsal waits for the coming weekend.
  assert.deepEqual(nextWorshipBlock('2026-09-30', WEEKEND_DAYS), {
    start: '2026-10-03',
    end: '2026-10-04',
    days: [SATURDAY, SUNDAY],
  })
})

test('a block may begin on the rehearsal day itself', () => {
  // Rehearse and serve the same day is allowed, so the scan starts at offset 0.
  assert.equal(nextWorshipBlock('2026-09-30', MIDWEEK_DAYS)?.start, '2026-09-30')
  // Landing on the block's last day yields a one-day remainder.
  const thursdayOnly = nextWorshipBlock('2026-10-01', MIDWEEK_DAYS)
  assert.equal(thursdayOnly?.start, '2026-10-01')
  assert.equal(thursdayOnly?.end, '2026-10-01')
  assert.deepEqual(thursdayOnly?.days, [THURSDAY])
})

test('blocks wrap across month and year boundaries', () => {
  assert.deepEqual(nextWorshipBlock('2026-12-30', MIDWEEK_DAYS), {
    start: '2026-12-30',
    end: '2026-12-31',
    days: [WEDNESDAY, THURSDAY],
  })
  // New Year's Eve is a Thursday, so only that one midweek day remains.
  assert.deepEqual(nextWorshipBlock('2026-12-31', MIDWEEK_DAYS), {
    start: '2026-12-31',
    end: '2026-12-31',
    days: [THURSDAY],
  })
  // A non-worship start rolls forward into the next year.
  assert.deepEqual(nextWorshipBlock('2027-01-01', MIDWEEK_DAYS), {
    start: '2027-01-06',
    end: '2027-01-07',
    days: [WEDNESDAY, THURSDAY],
  })
  assert.deepEqual(nextWorshipBlock('2026-10-30', WEEKEND_DAYS), {
    start: '2026-10-31',
    end: '2026-11-01',
    days: [SATURDAY, SUNDAY],
  })
})

test('an unconfigured choir yields no block', () => {
  assert.equal(nextWorshipBlock('2026-09-26', []), null)
  assert.equal(nextWorshipBlock('not a date', MIDWEEK_DAYS), null)
})

test('suggestPagtupadBlock is the next block after the rehearsal', () => {
  assert.equal(suggestPagtupadBlock('2026-09-26', MIDWEEK_SCHEDULES)?.start, '2026-09-30')
  assert.equal(suggestPagtupadBlock('2026-09-26', MIDWEEK_SCHEDULES)?.end, '2026-10-01')
  assert.equal(suggestPagtupadBlock('2026-10-03', WEEKEND_SCHEDULES)?.start, '2026-10-10')
  assert.equal(suggestPagtupadBlock('2026-10-03', WEEKEND_SCHEDULES)?.end, '2026-10-11')
  assert.equal(suggestPagtupadBlock('2026-09-26', []), null)
})

test('nextWorshipDateKey still resolves a single day', () => {
  assert.equal(nextWorshipDateKey('2026-09-30'), '2026-10-01')
  assert.equal(nextWorshipDateKey('2026-10-03'), '2026-10-04')
  assert.equal(
    nextWorshipDateKey('2026-09-26', schedulesForTemplate('midweek-2w')),
    '2026-09-30',
  )
  assert.equal(
    nextWorshipDateKey('2026-10-03', schedulesForTemplate('weekend-2w')),
    '2026-10-04',
  )
  assert.equal(nextWorshipDateKey('not a date'), null)
})

test('the Pagsasanay date is never moved by the planner', () => {
  for (const start of ['2026-10-02', '2026-09-26', '2026-09-25', '2026-10-05']) {
    for (const template of ['midweek-2w', 'weekend-2w', 'one-week'] as const) {
      const events = planEventsFromCoverage({ template, startDate: start })
      const rehearsals = events.filter((e) => e.type === 'pagsasanay')
      assert.ok(rehearsals.length > 0, 'expected a rehearsal event')
      assert.equal(rehearsals[0].date, start, `rehearsal moved for ${template}`)
    }
  }
})

test('midweek Pagtupad covers Wednesday AND Thursday', () => {
  const events = planEventsFromCoverage({
    template: 'midweek-2w',
    startDate: '2026-09-26', // Saturday rehearsal
  })
  assert.deepEqual(
    events.map((e) => [e.type, e.date, e.endDate]),
    [
      ['pagsasanay', '2026-09-26', undefined],
      ['pagtupad', '2026-09-30', '2026-10-01'],
      ['pagsasanay', '2026-10-03', undefined],
      ['pagtupad', '2026-10-07', '2026-10-08'],
    ],
  )
})

test('weekend Pagtupad covers Saturday AND Sunday of the FOLLOWING weekend', () => {
  // A Saturday rehearsal must not serve the same weekend it rehearsed for, so
  // the service is the next Sat+Sun. The second week's rehearsal then sits on a
  // Saturday too and pushes its own service out by another week.
  const events = planEventsFromCoverage({
    template: 'weekend-2w',
    startDate: '2026-10-03', // Saturday rehearsal
  })
  assert.deepEqual(
    events.map((e) => [e.type, e.date, e.endDate]),
    [
      ['pagsasanay', '2026-10-03', undefined],
      ['pagtupad', '2026-10-10', '2026-10-11'],
      ['pagsasanay', '2026-10-10', undefined],
      ['pagtupad', '2026-10-17', '2026-10-18'],
    ],
  )
})

test('a weekend rehearsal never lands on its own weekend', () => {
  // The rule is stated for each of the three Saturday examples so a regression
  // in the scan offset cannot reintroduce the same-weekend service.
  const cases: Array<[string, string]> = [
    ['2026-10-03', '2026-10-10'],
    ['2026-10-10', '2026-10-17'],
    ['2026-10-17', '2026-10-24'],
  ]
  for (const [rehearsal, expected] of cases) {
    const block = suggestPagtupadBlock(rehearsal, WEEKEND_SCHEDULES)
    assert.equal(block?.start, expected, `Pagtupad after ${rehearsal}`)
    assert.ok(block!.start > rehearsal, 'Pagtupad must follow the rehearsal')
  }
})

test('a weekend Pagtupad always ends on the Sunday of its own block', () => {
  for (const rehearsal of ['2026-10-03', '2026-10-17', '2026-10-31', '2026-12-26']) {
    const block = suggestPagtupadBlock(rehearsal, WEEKEND_SCHEDULES)
    assert.ok(block, `expected a block for ${rehearsal}`)
    assert.equal(weekdayOf(block!.start), SATURDAY, `${rehearsal} must start on Saturday`)
    assert.equal(weekdayOf(block!.end), SUNDAY, `${rehearsal} must end on Sunday`)
  }
})

test('weekend boundaries survive month and year rollovers', () => {
  // Oct 31 (Sat) -> Nov 7-8, and Dec 26 (Sat) -> Jan 2-3 of the next year.
  assert.equal(suggestPagtupadBlock('2026-10-31', WEEKEND_SCHEDULES)?.end, '2026-11-08')
  assert.equal(suggestPagtupadBlock('2026-12-26', WEEKEND_SCHEDULES)?.start, '2027-01-02')
  // Feb 2028 has no 29th; the arithmetic must not depend on it existing.
  assert.equal(suggestPagtupadBlock('2028-02-26', WEEKEND_SCHEDULES)?.end, '2028-03-05')
})

test('a rehearsal resolves the whole worship week: Wed, Thu, Sat, Sun', () => {
  const week = worshipWeekFromRehearsal('2026-10-07')
  assert.deepEqual(week, {
    wednesday: '2026-10-07',
    thursday: '2026-10-08',
    saturday: '2026-10-10',
    sunday: '2026-10-11',
  })
})

test('a rehearsal on any weekday maps into that calendar week', () => {
  // Tuesday 2026-10-06 and Saturday 2026-10-10 both belong to Oct 5-11.
  for (const rehearsal of ['2026-10-05', '2026-10-06', '2026-10-10', '2026-10-11']) {
    assert.deepEqual(worshipWeekFromRehearsal(rehearsal), {
      wednesday: '2026-10-07',
      thursday: '2026-10-08',
      saturday: '2026-10-10',
      sunday: '2026-10-11',
    })
  }
})

test('a rehearsal week crossing a month boundary keeps its four days', () => {
  assert.deepEqual(worshipWeekFromRehearsal('2026-10-31'), {
    wednesday: '2026-10-28',
    thursday: '2026-10-29',
    saturday: '2026-10-31',
    sunday: '2026-11-01',
  })
})

test('a blank or invalid rehearsal date derives no week', () => {
  assert.equal(worshipWeekFromRehearsal(''), null)
  assert.equal(worshipWeekFromRehearsal('2026-02-30'), null)
})

test('a 2-week Pagtupad override shifts the whole block for both weeks', () => {
  const events = planEventsFromCoverage({
    template: 'weekend-2w',
    startDate: '2026-10-03',
    pagtupadStartOverride: '2026-10-07',
    pagtupadEndOverride: '2026-10-08',
  })
  assert.deepEqual(
    events.map((e) => [e.type, e.date, e.endDate]),
    [
      ['pagsasanay', '2026-10-03', undefined],
      ['pagtupad', '2026-10-07', '2026-10-08'],
      ['pagsasanay', '2026-10-10', undefined],
      ['pagtupad', '2026-10-14', '2026-10-15'],
    ],
  )
})

test('overriding only the start collapses the range to one day', () => {
  const events = planEventsFromCoverage({
    template: 'weekend-2w',
    startDate: '2026-10-03',
    pagtupadStartOverride: '2026-10-07',
  })
  assert.equal(events[1].date, '2026-10-07')
  assert.equal(events[1].endDate, '2026-10-07')
})

test('empty overrides fall back to the suggested block', () => {
  const events = planEventsFromCoverage({
    template: 'weekend-2w',
    startDate: '2026-10-03',
    pagtupadStartOverride: '',
    pagtupadEndOverride: '',
  })
  assert.equal(events[1].date, '2026-10-10')
  assert.equal(events[1].endDate, '2026-10-11')
})

test('one-week Pagtupad follows the detected week and can be overridden', () => {
  // A Wednesday training 2026-09-30 sits in the Sept 28 – Oct 4 week, so the
  // suggested service runs Wednesday..Sunday of that same week.
  const suggested = planEventsFromCoverage({
    template: 'one-week',
    startDate: '2026-09-30',
    oneWeekDate: '2026-09-30',
  })
  assert.deepEqual(
    suggested.map((e) => [e.type, e.date, e.endDate]),
    [
      ['pagsasanay', '2026-09-30', undefined],
      ['pagtupad', '2026-09-30', '2026-10-04'],
    ],
  )

  const overridden = planEventsFromCoverage({
    template: 'one-week',
    startDate: '2026-09-30',
    oneWeekDate: '2026-09-30',
    oneWeekPagtupadDate: '2026-10-03',
    oneWeekPagtupadEndDate: '2026-10-04',
  })
  assert.equal(overridden[1].date, '2026-10-03')
  assert.equal(overridden[1].endDate, '2026-10-04')
})

test('one-week covers the whole detected week around a Saturday training', () => {
  // The user example: training Saturday 2026-09-26, worship week Wed 09-23,
  // Thu 09-24, Sat 09-26, Sun 09-27.
  const events = planEventsFromCoverage({
    template: 'one-week',
    startDate: '2026-09-26',
    oneWeekPagsasanayDate: '2026-09-26',
  })
  assert.deepEqual(
    events.map((e) => [e.type, e.date, e.endDate]),
    [
      ['pagsasanay', '2026-09-26', undefined],
      ['pagtupad', '2026-09-23', '2026-09-27'],
    ],
  )
})

test('worshipWeekSchedules resolves every slot of the detected week to a date', () => {
  const dated = worshipWeekSchedules('2026-09-26')
  assert.deepEqual(
    dated.map(({ schedule, date }) => [schedule.id, date]),
    [
      ['miyerkules-7pm', '2026-09-23'],
      ['huwebes-6am', '2026-09-24'],
      ['huwebes-7pm', '2026-09-24'],
      ['sabado-6pm', '2026-09-26'],
      ['linggo-6am', '2026-09-27'],
      ['linggo-10am', '2026-09-27'],
    ],
  )
  assert.deepEqual(worshipWeekSchedules(''), [])
  assert.deepEqual(worshipWeekSchedules('not a date'), [])
})

test('worshipWeekSchedules picks up a custom Wednesday time added in Settings', () => {
  const custom: WorshipSchedule[] = [
    ...DEFAULT_SCHEDULE_CATEGORIES.midweek,
    {
      id: 'miyerkules-8pm',
      scheduleDay: 'MIYERKULES',
      weekday: 3,
      scheduleTime: '8:00 PM',
      label: 'Miyerkules, 8:00 PM',
      presetHint: '',
      custom: true,
    },
  ]
  const dated = worshipWeekSchedules('2026-09-26', custom)
  const slots = dated.filter((entry) => entry.schedule.id === 'miyerkules-8pm')
  assert.equal(slots.length, 1)
  assert.equal(slots[0].schedule.scheduleTime, '8:00 PM')
  assert.equal(slots[0].date, '2026-09-23')
})

test('planEventsFromCoverage plans midweek around a custom worship schedule', () => {
  const custom: WorshipScheduleCategories = {
    midweek: [
      ...DEFAULT_SCHEDULE_CATEGORIES.midweek,
      {
        id: 'biyernes-7pm',
        scheduleDay: 'BIYERNES',
        weekday: 5,
        scheduleTime: '7:00 PM',
        label: 'BIYERNES, 7:00 PM',
        presetHint: '',
        custom: true,
      },
    ],
    weekend: DEFAULT_SCHEDULE_CATEGORIES.weekend,
  }
  const events = planEventsFromCoverage(
    { template: 'midweek-2w', startDate: '2026-09-28' },
    custom,
  )
  const firstPagtupad = events.find((e) => e.type === 'pagtupad')
  // Wednesday training resolves to a midweek block that now runs to Friday,
  // because that is the configured worship schedule.
  assert.equal(firstPagtupad?.date, '2026-09-30')
  assert.equal(firstPagtupad?.endDate, '2026-10-02')
  assert.deepEqual(
    events.map((e) => [e.type, e.date, e.endDate]),
    [
      ['pagsasanay', '2026-09-28', undefined],
      ['pagtupad', '2026-09-30', '2026-10-02'],
      ['pagsasanay', '2026-10-05', undefined],
      ['pagtupad', '2026-10-07', '2026-10-09'],
    ],
  )
})

test('a blank Pagsasanay date plans nothing, and never falls back to today', () => {
  // A new Suguan starts with no date. The planner used to substitute
  // `todayPHT()` here, which silently printed a date the user never chose.
  for (const template of ['midweek-2w', 'weekend-2w', 'one-week'] as const) {
    assert.deepEqual(planEventsFromCoverage({ template, startDate: '' }), [])
    assert.deepEqual(planEventsFromCoverage({ template, startDate: 'garbage' }), [])
    assert.deepEqual(planEventsFromCoverage({ template, startDate: '2026-13-45' }), [])
  }
})

test('a blank date plans nothing even when overrides are present', () => {
  // An override cannot stand in for the Pagsasanay date it is derived from.
  assert.deepEqual(
    planEventsFromCoverage({
      template: 'weekend-2w',
      startDate: '',
      pagtupadStartOverride: '2026-10-03',
      pagtupadEndOverride: '2026-10-04',
    }),
    [],
  )
})

test('one-week still plans from its own date fields when startDate is blank', () => {
  // Legacy one-week records may live only in `oneWeekDate` (or
  // `oneWeekPagsasanayDate`), with `startDate` never set. Those must still
  // detect a full week.
  const events = planEventsFromCoverage({
    template: 'one-week',
    startDate: '',
    oneWeekDate: '2026-09-30',
    oneWeekPagsasanayDate: '2026-09-30',
  })
  assert.deepEqual(
    events.map((e) => [e.type, e.date, e.endDate]),
    [
      ['pagsasanay', '2026-09-30', undefined],
      ['pagtupad', '2026-09-30', '2026-10-04'],
    ],
  )
})

test('every planned two-week Pagtupad is a maximal run of real worship days', () => {
  // One-week is deliberately excluded: its Pagtupad spans the whole detected
  // week (Wed..Sun), which includes a bare Friday between worship days.
  for (const template of ['midweek-2w', 'weekend-2w'] as const) {
    const allowed = new Set(worshipWeekdays(schedulesForTemplate(template)))
    for (const start of ['2026-09-30', '2026-10-03', '2026-10-07', '2026-10-31']) {
      const events = planEventsFromCoverage({ template, startDate: start })
      for (const event of events) {
        if (event.type !== 'pagtupad') continue
        const end = event.endDate ?? event.date
        const label = `${template} ${start}: ${event.date}..${end}`

        // Every day in the range is a configured worship day.
        for (let d = event.date; d <= end; d = addDays(d, 1)) {
          assert.equal(allowed.has(weekdayOf(d)), true, `${label}: ${d} is not a worship day`)
        }
        // And the run is maximal: the next day is not a worship day, so the
        // block always covers the choir's whole service stretch.
        assert.equal(
          allowed.has(weekdayOf(addDays(end, 1))),
          false,
          `${label}: block stops early`,
        )
      }
    }
  }
})

