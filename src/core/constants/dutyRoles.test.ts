import assert from 'node:assert/strict'
import test from 'node:test'
import {
  findDutyRoleByName,
  normalizeRoleName,
  resolveOicDutyRole,
  resolvePmDutyRole,
} from './dutyRoles.ts'

const role = (id: string, name: string) => ({ id, name })

test('resolveOicDutyRole matches the role named OIC, not the old stored id', () => {
  // A configured role that happens to carry the old `oic` id is not the OIC
  // ranking unless it is also named OIC; the name is the source of truth.
  const byName = role('role-1', 'OIC')
  assert.equal(
    resolveOicDutyRole([role('oic', 'Officer in Charge'), byName]),
    byName,
  )
})

test('resolveOicDutyRole falls back to a role the user named OIC', () => {
  const byName = role('V1StGXR8_Z5jdHi6B', 'OIC')
  assert.equal(
    resolveOicDutyRole([role('abc', 'Organista'), byName]),
    byName,
  )
})

test('resolveOicDutyRole ignores surrounding space and case', () => {
  const byName = role('abc', '  oic  ')
  assert.equal(resolveOicDutyRole([byName]), byName)
})

test('resolveOicDutyRole returns undefined when nothing represents OIC', () => {
  assert.equal(resolveOicDutyRole([role('abc', 'Organista')]), undefined)
  assert.equal(resolveOicDutyRole([]), undefined)
})

test('resolveOicDutyRole does not match a longer name', () => {
  assert.equal(resolveOicDutyRole([role('abc', 'OIC Reserve')]), undefined)
})

test('normalizeRoleName ignores case, spacing, and punctuation', () => {
  assert.equal(normalizeRoleName('Pangulong Mang-aawit'), 'pangulongmangaawit')
  assert.equal(normalizeRoleName('  O.I.C.  '), 'oic')
  assert.equal(normalizeRoleName(''), '')
})

test('findDutyRoleByName matches by name whatever the configured id is', () => {
  const roles = [
    role('zTudCx73-YMHh0PCdbjs2', 'Organista'),
    role('Ccuo8FLgJo4lgfK19ildr', 'Pangulong Mang-aawit'),
  ]
  assert.equal(
    findDutyRoleByName(roles, 'pangulong mang aawit')?.id,
    'Ccuo8FLgJo4lgfK19ildr',
  )
  assert.equal(findDutyRoleByName(roles, 'Kalihim'), undefined)
  assert.equal(findDutyRoleByName(roles, '  '), undefined)
})

test('resolvePmDutyRole finds the configured Pangulong Mang-aawit role', () => {
  const pm = role('Ccuo8FLgJo4lgfK19ildr', 'Pangulong Mang-aawit')
  assert.equal(resolvePmDutyRole([role('abc', 'Organista'), pm]), pm)
  assert.equal(resolvePmDutyRole([role('abc', 'Organista')]), undefined)
  assert.equal(resolvePmDutyRole([]), undefined)
  // A role that merely contains the rank's name is not a match.
  assert.equal(resolvePmDutyRole([role('abc', 'Assistant Pangulong')]), undefined)
})
