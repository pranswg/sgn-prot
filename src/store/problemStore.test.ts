import assert from 'node:assert/strict'
import test from 'node:test'
import { PROBLEM_DEFAULT_TITLE, showProblems, useProblemStore } from './problemStore.ts'

function reset() {
  useProblemStore.setState({
    open: false,
    title: PROBLEM_DEFAULT_TITLE,
    description: '',
    problems: [],
  })
}

test('showProblems opens the shared window with the list and a title', () => {
  reset()
  showProblems(['Destinado is required.', 'Pick a service type.'], {
    title: 'Fix these before saving',
  })
  const state = useProblemStore.getState()
  assert.equal(state.open, true)
  assert.equal(state.title, 'Fix these before saving')
  assert.deepEqual(state.problems, ['Destinado is required.', 'Pick a service type.'])
})

test('showProblems drops blank entries and no-ops when nothing is left', () => {
  reset()
  showProblems(['', '  ', 'Only this one counts'])
  assert.deepEqual(useProblemStore.getState().problems, ['Only this one counts'])
  assert.equal(useProblemStore.getState().title, PROBLEM_DEFAULT_TITLE)

  reset()
  showProblems(['', '   '])
  assert.equal(useProblemStore.getState().open, false)
})

test('close hides the window without clearing the last list', () => {
  reset()
  showProblems(['One problem'])
  useProblemStore.getState().close()
  const state = useProblemStore.getState()
  assert.equal(state.open, false)
  assert.deepEqual(state.problems, ['One problem'])
})
