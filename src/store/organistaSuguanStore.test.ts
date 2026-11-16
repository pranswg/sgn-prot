import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_DOC_FORMAT } from '@/lib/suguanUtils.ts'
import { useOrganistaSuguanStore } from './organistaSuguanStore.ts'

const input = {
  churchName: 'Templo Central',
  pagsasanayDate: '2026-11-14',
  services: [
    {
      id: 'svc-1',
      heading: 'Miyerkules 7:00 PM',
      organist: 'Juan Cruz',
      reserve: '',
    },
  ],
  docFormat: DEFAULT_DOC_FORMAT,
  pangulongMangaawitName: 'Maria Santos',
  destinadoName: 'Pedro Reyes',
}

test('updating an Organist Suguan keeps its identity and roster', () => {
  useOrganistaSuguanStore.setState({ records: [] })
  const record = useOrganistaSuguanStore.getState().createRecord(input)

  useOrganistaSuguanStore.getState().updateRecord(record.id, {
    ...input,
    churchName: 'Lokal ng Baguio',
    destinadoName: 'Ana Lopez',
  })

  const updated = useOrganistaSuguanStore
    .getState()
    .records.find((item) => item.id === record.id)
  assert.ok(updated)
  assert.equal(updated.id, record.id)
  // A history row is ordered by creation, so editing must not restamp it.
  assert.equal(updated.createdAt, record.createdAt)
  assert.equal(updated.churchName, 'Lokal ng Baguio')
  assert.equal(updated.destinadoName, 'Ana Lopez')
  assert.equal(updated.services[0]?.heading, 'Miyerkules 7:00 PM')
})

test('updating an unknown Organist Suguan changes nothing', () => {
  useOrganistaSuguanStore.setState({ records: [] })
  useOrganistaSuguanStore.getState().updateRecord('missing', input)
  assert.deepEqual(useOrganistaSuguanStore.getState().records, [])
})
