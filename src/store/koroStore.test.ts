import test from 'node:test'
import assert from 'node:assert/strict'
import { useKoroStore } from '@/store/koroStore'
import { createKoroDocument } from '@/lib/koro'

test('importData keeps the seeded local document when the server is empty', () => {
  const before = useKoroStore.getState().documents
  assert.ok(before.length >= 1)
  useKoroStore.getState().importData([])
  assert.equal(useKoroStore.getState().documents.length, before.length)
})

test('importData replaces documents and repairs a dangling active id', () => {
  const document = { ...createKoroDocument(), id: 'server-doc' }
  useKoroStore.getState().importData([document])
  assert.deepEqual(useKoroStore.getState().documents, [document])
  assert.equal(useKoroStore.getState().activeDocumentId, 'server-doc')
})
