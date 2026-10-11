import test from 'node:test'
import assert from 'node:assert/strict'
import { persist, setWriteNotifier } from './writeThrough.ts'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

test('persist leaves state alone when the write succeeds', async () => {
  let rolledBack = false
  const notifications: string[] = []
  setWriteNotifier((message) => notifications.push(message))

  persist({
    write: Promise.resolve({ error: null }),
    rollback: () => {
      rolledBack = true
    },
    failure: 'nope',
  })
  await flush()

  assert.equal(rolledBack, false)
  assert.deepEqual(notifications, [])
})

test('persist rolls back and notifies when the write fails', async () => {
  let rolledBack = false
  const notifications: string[] = []
  setWriteNotifier((message) => notifications.push(message))

  persist({
    write: Promise.resolve({ error: 'permission denied' }),
    rollback: () => {
      rolledBack = true
    },
    failure: 'Could not save settings.',
  })
  await flush()

  assert.equal(rolledBack, true)
  assert.deepEqual(notifications, ['Could not save settings.'])
})

test('persist treats a missing result as success', async () => {
  let rolledBack = false
  const notifications: string[] = []
  setWriteNotifier((message) => notifications.push(message))

  persist({
    write: Promise.resolve(undefined as never),
    rollback: () => {
      rolledBack = true
    },
    failure: 'nope',
  })
  await flush()

  assert.equal(rolledBack, false)
  assert.deepEqual(notifications, [])
})

test('persist rolls back the whole action when one of several writes fails', async () => {
  let rolledBack = false
  const notifications: string[] = []
  setWriteNotifier((message) => notifications.push(message))

  persist({
    write: [
      Promise.resolve({ error: null }),
      Promise.resolve({ error: 'trainee write failed' }),
    ],
    rollback: () => {
      rolledBack = true
    },
    failure: 'Could not promote the trainee.',
  })
  await flush()

  assert.equal(rolledBack, true)
  assert.deepEqual(notifications, ['Could not promote the trainee.'])
})

test('persist accepts a batch where every write succeeds', async () => {
  let rolledBack = false
  const notifications: string[] = []
  setWriteNotifier((message) => notifications.push(message))

  persist({
    write: [
      Promise.resolve({ error: null }),
      Promise.resolve({ error: null }),
    ],
    rollback: () => {
      rolledBack = true
    },
    failure: 'nope',
  })
  await flush()

  assert.equal(rolledBack, false)
  assert.deepEqual(notifications, [])
})
