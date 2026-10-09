import assert from 'node:assert/strict'
import test from 'node:test'
import { isSupabaseConfigured } from '@/lib/supabase.ts'
import { useAuthStore } from './authStore.ts'

test('the auth store fails closed without a configured backend', async () => {
  assert.equal(isSupabaseConfigured, false)
  const result = await useAuthStore.getState().signIn('someone', 'password123')
  assert.equal('problems' in result, true)
})

test('bootstrap marks the store ready without a session', async () => {
  useAuthStore.setState({ ready: false })
  await useAuthStore.getState().bootstrap()
  assert.equal(useAuthStore.getState().ready, true)
  assert.equal(useAuthStore.getState().currentAccountId, null)
})

test('clear resets the account mirror', () => {
  useAuthStore.setState({
    accounts: [
      {
        id: 'x',
        username: 'x',
        fullName: 'X',
        role: 'admin',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    currentAccountId: 'x',
  })
  useAuthStore.getState().clear()
  assert.deepEqual(useAuthStore.getState().accounts, [])
  assert.equal(useAuthStore.getState().currentAccountId, null)
})
