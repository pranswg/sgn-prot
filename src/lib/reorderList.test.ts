/**
 * Reorder tests for the Settings list drag-and-drop.
 *
 * The interesting behaviour is which side of the hovered row the moved item
 * lands on, because that is what the user sees while dragging.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { reorderList } from './reorderList.ts'

const row = (id: string) => ({ id })
const ids = (items: { id: string }[]) => items.map((item) => item.id)

test('dropping a row onto the one below moves it down one place', () => {
  const list = ['a', 'b', 'c', 'd'].map(row)
  // a dragged onto b: it should end up where b was, not leap past it.
  assert.deepEqual(ids(reorderList(list, 'a', 1)), ['b', 'a', 'c', 'd'])
})

test('dropping a row onto the one above moves it up one place', () => {
  const list = ['a', 'b', 'c', 'd'].map(row)
  assert.deepEqual(ids(reorderList(list, 'b', 0)), ['b', 'a', 'c', 'd'])
})

test('a dragged row never crosses the row it is dropped on', () => {
  const list = ['a', 'b', 'c', 'd'].map(row)
  // Down: stays under d. Up: stays over a.
  assert.deepEqual(ids(reorderList(list, 'a', 3)), ['b', 'c', 'd', 'a'])
  assert.deepEqual(ids(reorderList(list, 'd', 0)), ['d', 'a', 'b', 'c'])
})

test('an unknown id, a no-op, or an index outside the list is ignored', () => {
  const list = ['a', 'b'].map(row)

  assert.equal(reorderList(list, 'missing', 1), list)
  assert.equal(reorderList(list, 'a', 0), list)
  assert.equal(reorderList(list, 'a', -1), list)
  assert.equal(reorderList(list, 'b', 2), list)
})

test('reorders compose, so dragging several rows lands on the final order', () => {
  const list = ['a', 'b', 'c'].map(row)
  const moved = reorderList(list, 'c', 0)
  assert.deepEqual(ids(moved), ['c', 'a', 'b'])
  assert.deepEqual(ids(reorderList(moved, 'a', 2)), ['c', 'b', 'a'])
})
