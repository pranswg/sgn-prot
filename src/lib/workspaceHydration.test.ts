import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveHydrationMode, resolveSettingHydration } from '@/lib/workspaceHydration'

test('seeds the server from the browser when the server is empty and uninitialised', () => {
  assert.equal(resolveHydrationMode(0, 3, false), 'seed')
})

test('server wins when it already has rows', () => {
  assert.equal(resolveHydrationMode(2, 3, false), 'replace')
})

test('does not seed an empty browser', () => {
  assert.equal(resolveHydrationMode(0, 0, false), 'replace')
})

test('an initialised workspace never seeds, even when the server is empty', () => {
  assert.equal(resolveHydrationMode(0, 3, true), 'replace')
})

test('a missing setting seeds only before initialisation', () => {
  assert.equal(resolveSettingHydration(false, false), 'seed')
})

test('a missing setting clears an initialised workspace instead of seeding', () => {
  assert.equal(resolveSettingHydration(false, true), 'clear')
})

test('an existing setting is replaced from the server regardless of marker', () => {
  assert.equal(resolveSettingHydration(true, false), 'replace')
  assert.equal(resolveSettingHydration(true, true), 'replace')
})
