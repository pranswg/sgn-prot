/**
 * Settings reference-list tests: the rules that decide whether a name can be
 * saved, and the duty-role abbreviation fallback.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  deriveAbbreviation,
  plural,
  referenceProblem,
  valuesFrom,
  type ReferenceField,
} from './referenceList.ts'

const existing = [
  { id: 'pagsamba', label: 'Pagsamba' },
  { id: 'kasal', label: 'Kasal' },
]

test('a blank name is refused before anything else', () => {
  assert.equal(referenceProblem('', existing, null), 'Enter a name.')
  assert.equal(referenceProblem('   ', existing, null), 'Enter a name.')
})

test('a second entry with the same name is refused, whatever its case', () => {
  assert.equal(
    referenceProblem('pagsamba', existing, null),
    'This name is already in the list.',
  )
  assert.equal(
    referenceProblem('  KASAL  ', existing, null),
    'This name is already in the list.',
  )
})

test('the entry being edited is allowed to keep its own name', () => {
  assert.equal(referenceProblem('Pagsamba', existing, 'pagsamba'), null)
})

test('a name no one else is using is accepted', () => {
  assert.equal(referenceProblem('Vespers', existing, null), null)
  assert.equal(referenceProblem('pagsamba ii', existing, 'kasal'), null)
})

test('the abbreviation fallback takes three letters, trimmed and uppercased', () => {
  assert.equal(deriveAbbreviation('Organista'), 'ORG')
  assert.equal(deriveAbbreviation('  kalihim '), 'KAL')
  assert.equal(deriveAbbreviation('oic'), 'OIC')
})

test('only the declared fields are read off a stored item', () => {
  const fields: ReferenceField[] = [
    { key: 'name', label: 'Name' },
    { key: 'abbreviation', label: 'Abbreviation' },
  ]
  const item = { id: 'oic', name: 'OIC', abbreviation: 'OIC', custom: false }

  assert.deepEqual(valuesFrom(item, fields), {
    name: 'OIC',
    abbreviation: 'OIC',
  })
  // A field the item does not carry comes back empty rather than undefined.
  assert.deepEqual(valuesFrom({ name: 'X' }, fields), {
    name: 'X',
    abbreviation: '',
  })
})

test('plural grows a list label the way the button and toast expect', () => {
  assert.equal(plural('service type'), 'service types')
  assert.equal(plural('duty role'), 'duty roles')
  assert.equal(plural('voice position'), 'voice positions')
})
