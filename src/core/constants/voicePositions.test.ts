import assert from 'node:assert/strict'
import test from 'node:test'
import { voiceShortName, withVoiceShortNames } from './voicePositions.ts'

test('standard choir voices abbreviate to a letter and a number', () => {
  assert.equal(voiceShortName('Soprano 1'), 'S1')
  assert.equal(voiceShortName('Soprano 2'), 'S2')
  assert.equal(voiceShortName('Alto'), 'A')
  assert.equal(voiceShortName('Tenor'), 'T')
  assert.equal(voiceShortName('Bass'), 'B')
})

test('short labels ignore case and stray spacing', () => {
  assert.equal(voiceShortName('  soprano   1 '), 'S1')
  assert.equal(voiceShortName('ALTO'), 'A')
})

test('other numbered voices take their initial plus the number', () => {
  assert.equal(voiceShortName('Soprano 3'), 'S3')
  assert.equal(voiceShortName('Alto 2'), 'A2')
})

test('a custom name keeps the two-letter fallback', () => {
  assert.equal(voiceShortName('Contralto'), 'CO')
  assert.equal(voiceShortName('Countertenor'), 'CO')
  assert.equal(voiceShortName(''), '')
})

test('withVoiceShortNames repairs a list saved under the old rule', () => {
  const voices = withVoiceShortNames([
    { id: 'soprano-1', name: 'Soprano 1', shortName: 'SO', gender: 'female' },
    { id: 'alto', name: 'Alto', shortName: 'AL', gender: 'female' },
    { id: 'tenor', name: 'Tenor', shortName: 'TE', gender: 'male' },
  ])
  assert.deepEqual(
    voices.map((voice) => voice.shortName),
    ['S1', 'A', 'T'],
  )
  assert.equal(voices[0].gender, 'female')
})
