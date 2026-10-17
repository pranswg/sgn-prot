import assert from 'node:assert/strict'
import test from 'node:test'

import type { OrganistaSuguanService } from '@/core/types/organistaSuguan'
import { DEFAULT_DOC_FORMAT } from '@/lib/suguanUtils'
import { buildOrganistaSuguanDocx } from './organistaSuguanDocx.ts'

test('Organist Suguan DOCX builder creates a Word document blob', async () => {
  const services: OrganistaSuguanService[] = [
    {
      id: 'service-1',
      heading: 'Sabado 7:00 PM',
      organist: 'Ana Reyes',
      reserve: 'Maria Santos',
    },
  ]

  const blob = await buildOrganistaSuguanDocx(
    'Sta. Monica',
    '2026-10-11',
    services,
    {
      ...DEFAULT_DOC_FORMAT,
      tableSpacingBeforePt: 2,
      tableSpacingAfterPt: 3,
    },
    'Juan Dela Cruz',
    'Pedro Santos',
  )

  assert.equal(
    blob.type,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  )
  assert.ok(blob.size > 0)
})
