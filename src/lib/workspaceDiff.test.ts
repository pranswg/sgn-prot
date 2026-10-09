import assert from 'node:assert/strict'
import test from 'node:test'
import {
  diffCollection,
  resolveBatch,
  snapshotCollection,
} from '@/lib/workspaceDiff'

interface Row {
  id: string
  name: string
}

test('snapshotCollection keys serialized records by id', () => {
  const snapshot = snapshotCollection<Row>([
    { id: 'a', name: 'Ana' },
    { id: 'b', name: 'Ben' },
  ])
  assert.equal(snapshot.get('a'), JSON.stringify({ id: 'a', name: 'Ana' }))
  assert.equal(snapshot.size, 2)
})

test('diffCollection reports nothing when the records are unchanged', () => {
  const records: Row[] = [{ id: 'a', name: 'Ana' }]
  const { diff, snapshot } = diffCollection(snapshotCollection(records), records)
  assert.deepEqual(diff.upserts, [])
  assert.deepEqual(diff.deletes, [])
  assert.equal(snapshot.get('a'), JSON.stringify(records[0]))
})

test('diffCollection upserts a new record and a changed record', () => {
  const previous = snapshotCollection<Row>([{ id: 'a', name: 'Ana' }])
  const { diff } = diffCollection(previous, [
    { id: 'a', name: 'Ana Maria' },
    { id: 'b', name: 'Ben' },
  ])
  assert.deepEqual(
    diff.upserts.map((row) => row.name),
    ['Ana Maria', 'Ben'],
  )
  assert.deepEqual(diff.deletes, [])
})

test('diffCollection deletes anything missing from the current records', () => {
  const previous = snapshotCollection<Row>([
    { id: 'a', name: 'Ana' },
    { id: 'b', name: 'Ben' },
  ])
  const { diff, snapshot } = diffCollection(previous, [{ id: 'a', name: 'Ana' }])
  assert.deepEqual(diff.upserts, [])
  assert.deepEqual(diff.deletes, ['b'])
  assert.equal(snapshot.has('b'), false)
})

test('resolveBatch lets a delete win over an upsert of the same id', () => {
  const upserts = new Map<string, Row>([
    ['a', { id: 'a', name: 'Ana' }],
    ['b', { id: 'b', name: 'Ben' }],
  ])
  const deletes = new Set(['a'])
  const { upserts: resolved, deletes: removed } = resolveBatch(upserts, deletes)
  assert.deepEqual(
    resolved.map((row) => row.id),
    ['b'],
  )
  assert.deepEqual(removed, ['a'])
})
