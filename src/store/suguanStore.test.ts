import assert from 'node:assert/strict'
import test from 'node:test'
import { useSuguanStore } from './suguanStore.ts'

test('Suguan clear and restoreData replace the saved history locally', () => {
  useSuguanStore.getState().clear()

  const created = useSuguanStore.getState().createSuguan({
    date: '2026-10-08',
    time: '07:00',
    serviceTypeId: 'pagsamba',
  })
  assert.equal(useSuguanStore.getState().suguan.length, 1)

  useSuguanStore.getState().clear()
  assert.equal(useSuguanStore.getState().suguan.length, 0)

  useSuguanStore.getState().restoreData([created])
  const restored = useSuguanStore.getState()
  assert.equal(restored.suguan.length, 1)
  assert.equal(restored.suguan[0]?.id, created.id)

  useSuguanStore.getState().restoreData([])
  assert.equal(useSuguanStore.getState().suguan.length, 0)

  useSuguanStore.getState().clear()
})
