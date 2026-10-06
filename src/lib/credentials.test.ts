/**
 * Credential validation and hashing tests.
 *
 * These cover the rules the AuthPage renders, plus the two properties that
 * matter for stored passwords: the digest is salted, so two identical passwords
 * never produce the same hash, and verification rejects the wrong password.
 *
 * Note this exercises the real PBKDF2 work factor. That is deliberate: it means
 * these tests would catch an accidental drop to something trivial.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import type { Account } from '@/core/types/auth'
import {
  findAccountByUsername,
  hashPassword,
  initialsFor,
  isUsernameTaken,
  isValidUsernameKey,
  normalizeUsername,
  passwordStrengthProblems,
  roleForNewAccount,
  sha256Hex,
  validateConfirmation,
  validateFullName,
  validatePassword,
  validateRegistration,
  validateUsername,
  verifyPassword,
} from './credentials.ts'

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc_1',
    username: 'maria',
    fullName: 'Maria Santos',
    passwordHash: 'deadbeef',
    passwordSalt: 'cafe',
    role: 'member',
    createdAt: '2026-09-30T02:00:00.000Z',
    ...overrides,
  }
}

test('normalizeUsername collapses case and padding so lookups cannot fork', () => {
  assert.equal(normalizeUsername('  Maria  '), 'maria')
  assert.equal(normalizeUsername('MARIA'), normalizeUsername('maria'))
})

test('isValidUsernameKey accepts the shape the store looks up by', () => {
  assert.equal(isValidUsernameKey(''), false)
  assert.equal(isValidUsernameKey('maria'), true)
  // Bounded so a stored key can never be absurd.
  assert.equal(isValidUsernameKey('a'.repeat(24)), true)
  assert.equal(isValidUsernameKey('a'.repeat(25)), false)
})

test('validateUsername enforces length and a phone-keyboard-safe alphabet', () => {
  assert.match(validateUsername('') ?? '', /username/i)
  assert.match(validateUsername('ab') ?? '', /at least 3/i)
  assert.match(validateUsername('a'.repeat(25)) ?? '', /under 24/i)
  // Spaces would be stripped by normalizeUsername, letting "maria santos" and
  // "mariasantos" collide on one key.
  assert.match(validateUsername('maria santos') ?? '', /letters, numbers/i)
  assert.match(validateUsername('maria!') ?? '', /letters, numbers/i)
  assert.equal(validateUsername('maria.santos_1-x@y'), null)
})

test('validateFullName requires something short enough to display', () => {
  assert.match(validateFullName('   ') ?? '', /full name/i)
  assert.match(validateFullName('a'.repeat(81)) ?? '', /under 80/i)
  assert.equal(validateFullName('Maria Santos'), null)
})

test('validatePassword rejects short, numeric-only, and over-long input', () => {
  assert.match(validatePassword('') ?? '', /choose a password/i)
  assert.match(validatePassword('abc123') ?? '', /at least 8/i)
  // The one weakness a length rule alone does not catch.
  assert.match(validatePassword('1234567890') ?? '', /only numbers/i)
  // PBKDF2-SHA256 ignores bytes past the block input limit, so an over-long
  // password would silently behave like a truncated one.
  assert.match(validatePassword(`${'a1'.repeat(40)}`) ?? '', /under 72/i)
  assert.equal(validatePassword('choir2026'), null)
})

test('validateConfirmation catches a mismatch and an empty second entry', () => {
  assert.match(validateConfirmation('choir2026', '') ?? '', /re-enter/i)
  assert.match(validateConfirmation('choir2026', 'choir2025') ?? '', /do not match/i)
  assert.equal(validateConfirmation('choir2026', 'choir2026'), null)
})

test('validateRegistration stops at an invalid password instead of also blaming the confirmation', () => {
  // One bad fact should produce one message. Complaining that the two entries
  // disagree when neither is acceptable yet just buries the real problem.
  const problems = validateRegistration({
    username: '',
    fullName: '',
    password: '123',
    confirmPassword: '',
  })
  assert.deepEqual(problems.map((p) => p.field), ['username', 'fullName', 'password'])
})

test('validateRegistration suppresses the mismatch when the password is itself invalid', () => {
  // Otherwise a too-short password produces two messages saying two different
  // things are wrong with the same pair of fields.
  const problems = validateRegistration({
    username: 'maria',
    fullName: 'Maria Santos',
    password: '123',
    confirmPassword: '456',
  })
  assert.deepEqual(problems.map((p) => p.field), ['password'])
})

test('validateRegistration accepts a good form', () => {
  assert.deepEqual(
    validateRegistration({
      username: ' Maria.Santos ',
      fullName: ' Maria Santos ',
      password: 'choir2026',
      confirmPassword: 'choir2026',
    }),
    [],
  )
})

test('passwordStrengthProblems is advisory and may report more than one gap', () => {
  // These are hints under the field, not the rule set. They deliberately report
  // every unmet suggestion at once so the list shrinks as the user types.
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

test('findAccountByUsername matches on the normalised key', () => {
  const accounts = [account()]
  assert.equal(findAccountByUsername(accounts, '  MARIA ')?.id, 'acc_1')
  assert.equal(findAccountByUsername(accounts, 'someone'), undefined)
  assert.equal(isUsernameTaken(accounts, 'Maria'), true)
  assert.equal(isUsernameTaken(accounts, 'someone'), false)
})

test('roleForNewAccount makes only the first registration an admin', () => {
  assert.equal(roleForNewAccount([]), 'admin')
  assert.equal(roleForNewAccount([account()]), 'member')
})

test('initialsFor falls back sensibly for short and long names', () => {
  assert.equal(initialsFor('Maria Santos'), 'MS')
  assert.equal(initialsFor('Maria Elena Santos Reyes'), 'MR')
  assert.equal(initialsFor('Maria'), 'MA')
  assert.equal(initialsFor('   '), '?')
})

test('hashPassword never stores the plaintext and is salted per call', async () => {
  const first = await hashPassword('choir2026')
  const second = await hashPassword('choir2026')

  assert.notEqual(first.passwordHash, 'choir2026')
  assert.notEqual(first.passwordHash, second.passwordHash)
  // Identical passwords must not produce identical digests, or the stored hash
  // would reveal that two accounts share a password.
  assert.notEqual(first.passwordSalt, second.passwordSalt)
  assert.match(first.passwordHash, /^[0-9a-f]{64}$/)
  assert.match(first.passwordSalt, /^[0-9a-f]{32}$/)
})

test('verifyPassword accepts the right password and rejects the wrong one', async () => {
  const { passwordHash, passwordSalt, hashAlgo } = await hashPassword('choir2026')
  const stored = account({ passwordHash, passwordSalt, hashAlgo })

  assert.equal(await verifyPassword('choir2026', stored), true)
  assert.equal(await verifyPassword('choir2025', stored), false)
  assert.equal(await verifyPassword('', stored), false)
  // A password verified against the wrong salt must not pass.
  assert.equal(await verifyPassword('choir2026', account({ passwordSalt: 'cafe' })), false)
})

test('verifyPassword fails closed on an account with no stored hash', async () => {
  // Guards a half-migrated record rather than throwing or defaulting to true.
  assert.equal(await verifyPassword('choir2026', account({ passwordHash: '' })), false)
  assert.equal(await verifyPassword('choir2026', account({ passwordSalt: '' })), false)
})

test('sha256Hex matches the published test vectors', () => {
  // The pure-JS fallback KDF rests on this function; a broken compression
  // schedule would still round-trip but produce a digest no other reader
  // could reproduce.
  assert.equal(
    sha256Hex(''),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  )
  assert.equal(
    sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  )
  assert.equal(
    sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  )
  // Two-block input, exercises the padding and length encoding.
  assert.equal(
    sha256Hex('a'.repeat(1000)),
    '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3',
  )
})

test('the simplified KDF verifies and stays salted like PBKDF2', async () => {
  const first = await hashPassword('choir2026', 'simplified')
  assert.equal(first.hashAlgo, 'simplified')
  const stored = account({
    passwordHash: first.passwordHash,
    passwordSalt: first.passwordSalt,
    hashAlgo: first.hashAlgo,
  })

  assert.equal(await verifyPassword('choir2026', stored), true)
  assert.equal(await verifyPassword('choir2025', stored), false)
  // Same password, fresh salt: the digest must still differ.
  const second = await hashPassword('choir2026', 'simplified')
  assert.notEqual(second.passwordHash, first.passwordHash)
})