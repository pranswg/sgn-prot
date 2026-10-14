import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isMissingTableError,
  settingsRowToStoreData,
  unwrapRows,
  type DataRow,
} from './serverData.ts'

test('unwrapRows returns the data column of each row', () => {
  assert.deepEqual(unwrapRows([{ data: 1 }, { data: 2 }]), [1, 2])
  assert.deepEqual(unwrapRows([]), [])
  assert.deepEqual(unwrapRows(null), [])
  assert.deepEqual(unwrapRows(undefined), [])
})

test('unwrapRows preserves record identity verbatim', () => {
  const member = { id: 'm1', fullName: 'Dela Cruz, Juan' }
  const rows: DataRow<typeof member>[] = [{ data: member }]
  assert.equal(unwrapRows(rows)[0], member)
})

test('settingsRowToStoreData returns null for a missing row', () => {
  assert.equal(settingsRowToStoreData(null), null)
  assert.equal(settingsRowToStoreData(undefined), null)
})

test('settingsRowToStoreData splits the settings document into store fields', () => {
  const result = settingsRowToStoreData({
    data: {
      serviceTypes: [{ id: 's1', name: 'Vespers', custom: true }],
      dutyRoles: [{ id: 'r1', name: 'OIC', abbreviation: 'OIC', custom: true }],
      voices: [
        { id: 'v1', name: 'Soprano', shortName: 'SO', gender: 'female', custom: true },
      ],
      localeName: 'Sta. Monica',
      defaultServiceTypeId: 's1',
      midweek: [{ id: 'w1', weekday: 3, label: 'Midweek', custom: false }],
      weekend: [],
    },
  })
  assert.equal(result?.localeName, 'Sta. Monica')
  assert.equal(result?.defaultServiceTypeId, 's1')
  assert.deepEqual(result?.serviceTypes.map((item) => item.id), ['s1'])
  assert.deepEqual(result?.dutyRoles.map((item) => item.id), ['r1'])
  assert.deepEqual(result?.voices.map((item) => item.id), ['v1'])
  assert.deepEqual(result?.midweek.map((item) => item.id), ['w1'])
  assert.deepEqual(result?.weekend, [])
})

test('settingsRowToStoreData tolerates a partial or malformed document', () => {
  const result = settingsRowToStoreData({
    data: { localeName: 42, serviceTypes: 'nope', defaultServiceTypeId: 7 },
  })
  assert.equal(result?.localeName, '')
  assert.equal(result?.defaultServiceTypeId, null)
  assert.deepEqual(result?.serviceTypes, [])
  assert.deepEqual(result?.dutyRoles, [])
  assert.deepEqual(result?.voices, [])
  assert.deepEqual(result?.midweek, [])
  assert.deepEqual(result?.weekend, [])
})

test('settingsRowToStoreData rejects a non-object row payload', () => {
  assert.equal(settingsRowToStoreData({ data: null }), null)
  assert.equal(settingsRowToStoreData({ data: 'nope' }), null)
})

test('isMissingTableError detects a table the server has not seen yet', () => {
  assert.equal(isMissingTableError({ code: 'PGRST205' }), true)
  assert.equal(isMissingTableError({ code: '42P01' }), true)
  assert.equal(
    isMissingTableError({
      code: 'PGRST205',
      message:
        "Could not find the table 'public.extra_occasion_batches' in the schema cache",
    }),
    true,
  )
  assert.equal(
    isMissingTableError({ message: 'relation "public.foo" does not exist' }),
    true,
  )
})

test('isMissingTableError ignores other errors and non-objects', () => {
  assert.equal(isMissingTableError(null), false)
  assert.equal(isMissingTableError(undefined), false)
  assert.equal(isMissingTableError('nope'), false)
  assert.equal(isMissingTableError({ code: '42501' }), false)
  assert.equal(isMissingTableError({ code: 'PGRST301', message: 'JWT expired' }), false)
  assert.equal(
    isMissingTableError({ message: 'permission denied for table members' }),
    false,
  )
})
