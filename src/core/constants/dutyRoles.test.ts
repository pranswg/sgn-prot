import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveOicDutyRole } from './dutyRoles.ts'

const role = (id: string, name: string) => ({ id, name })

test('resolveOicDutyRole prefers the canonical id over a name match', () => {
  const canonical = role('oic', 'Officer in Charge')
  const byName = role('role-1', 'OIC')
  assert.equal(resolveOicDutyRole([byName, canonical]), canonical)
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
