import assert from 'node:assert/strict'
import test from 'node:test'

import { initialsFor, passwordStrengthProblems, validatePassword } from './credentials.ts'

test('validatePassword rejects short, numeric-only, and over-long input', () => {
  assert.match(validatePassword('') ?? '', /choose a password/i)
  assert.match(validatePassword('abc123') ?? '', /at least 8/i)
  // The one weakness a length rule alone does not catch.
  assert.match(validatePassword('1234567890') ?? '', /only numbers/i)
  assert.match(validatePassword('a1'.repeat(40)) ?? '', /under 72/i)
  assert.equal(validatePassword('choir2026'), null)
})

test('passwordStrengthProblems is advisory and may report more than one gap', () => {
  assert.deepEqual(passwordStrengthProblems(''), [
    'At least 8 characters',
    'Mix letters and numbers',
  ])
  assert.deepEqual(passwordStrengthProblems('12345678'), [
    'Not only numbers',
    'Mix letters and numbers',
  ])
  assert.deepEqual(passwordStrengthProblems('choir2026'), [])
})

test('initialsFor falls back sensibly for short and long names', () => {
  assert.equal(initialsFor('Maria Santos'), 'MS')
  assert.equal(initialsFor('Maria Elena Santos Reyes'), 'MR')
  assert.equal(initialsFor('Maria'), 'MA')
  assert.equal(initialsFor('   '), '?')
})
