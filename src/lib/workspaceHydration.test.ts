import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveHydrationMode } from '@/lib/workspaceHydration'

test('seeds the server from the browser when the server is empty', () => {
  assert.equal(resolveHydrationMode(0, 3), 'seed')
})

test('server wins when it already has rows', () => {
  assert.equal(resolveHydrationMode(2, 3), 'replace')
})

test('does not seed an empty browser', () => {
  assert.equal(resolveHydrationMode(0, 0), 'replace')
})
