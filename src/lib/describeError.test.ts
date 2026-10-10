import { describeError } from './describeError.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('an Error instance reports its message', () => {
  assert.equal(describeError(new Error('boom')), 'boom')
})

test('a string passes through unchanged', () => {
  assert.equal(describeError('network down'), 'network down')
})

test('a PostgrestError-like object reads as message and code', () => {
  assert.equal(
    describeError({ message: 'permission denied', code: '42501', details: null }),
    'permission denied (42501)',
  )
})

test('an object with only a message drops the code suffix', () => {
  assert.equal(describeError({ message: 'no rows' }), 'no rows')
})

test('an object without a message falls back to its JSON shape', () => {
  assert.equal(describeError({ error: 'token expired' }), '{"error":"token expired"}')
})

test('a message-less empty object falls back to String()', () => {
  assert.equal(describeError({}), '[object Object]')
})

test('null and undefined read as their literal names', () => {
  assert.equal(describeError(null), 'null')
  assert.equal(describeError(undefined), 'undefined')
})
