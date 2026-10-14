import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addOccasion,
  createPlannerOccasion,
  createSession,
  findOccasion,
  plannerOccasionLabel,
  removeOccasion,
  updateOccasion,
} from './extraOccasionSession'
import { emptyOccasionState, type ExtraOccasionOccasionState } from './extraOccasionDraft'

function state(name: string): ExtraOccasionOccasionState {
  const base = emptyOccasionState([], [], '')
  return { ...base, name }
}

test('createSession starts empty and unsaved', () => {
  const session = createSession('Planning')
  assert.equal(session.batchName, 'Planning')
  assert.equal(session.savedBatchId, null)
  assert.deepEqual(session.occasions, [])
  assert.ok(session.batchId.length > 0)
})

test('addOccasion appends in order', () => {
  let session = createSession()
  session = addOccasion(session, createPlannerOccasion(state('A')))
  session = addOccasion(session, createPlannerOccasion(state('B')))
  assert.deepEqual(
    session.occasions.map((o) => o.state.name),
    ['A', 'B'],
  )
})

test('updateOccasion marks the occasion dirty', () => {
  let session = addOccasion(createSession(), createPlannerOccasion(state('A')))
  const localId = session.occasions[0].localId
  session = updateOccasion(session, localId, state('A edited'))
  const updated = findOccasion(session, localId)
  assert.equal(updated?.state.name, 'A edited')
  assert.equal(updated?.dirty, true)
})

test('removeOccasion drops only the target', () => {
  let session = addOccasion(createSession(), createPlannerOccasion(state('A')))
  session = addOccasion(session, createPlannerOccasion(state('B')))
  const first = session.occasions[0].localId
  session = removeOccasion(session, first)
  assert.deepEqual(
    session.occasions.map((o) => o.state.name),
    ['B'],
  )
})

test('plannerOccasionLabel falls back to a positional label', () => {
  const blank = createPlannerOccasion(state(''))
  const named = createPlannerOccasion(state('Wedding'))
  assert.equal(plannerOccasionLabel(blank, 1), 'Occasion 2')
  assert.equal(plannerOccasionLabel(named, 0), 'Wedding')
})
