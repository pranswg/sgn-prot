import assert from 'node:assert/strict'
import test from 'node:test'

import type { OrganistaSuguanService } from '@/core/types/organistaSuguan'
import {
  DEFAULT_DOC_FORMAT,
  FONT_SIZE_PRESETS,
  resolveFontSizePreset,
} from '@/lib/suguanUtils'
import {
  buildOrganistaSuguanDocx,
  organistaDocxFontSizes,
} from './organistaSuguanDocx.ts'

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

/**
 * The Organist Suguan scales its whole sheet with the font preset, and the PDF
 * renderer is the reference: titles and service headings read
 * `headerFontSize`, member and signature names `bodyFontSize`, and labels and
 * signature roles `smallFontSize`. The Word export must use those same fields,
 * or changing the font size makes the two files disagree.
 */
test('Organist Suguan Word sizes follow the preset the PDF uses', () => {
  const normal = organistaDocxFontSizes(
    resolveFontSizePreset(DEFAULT_DOC_FORMAT),
  )
  assert.equal(normal.name, FONT_SIZE_PRESETS.normal.bodyFontSize)
  assert.equal(normal.signatureName, FONT_SIZE_PRESETS.normal.bodyFontSize)
  assert.equal(normal.signatureRole, FONT_SIZE_PRESETS.normal.smallFontSize)
  assert.equal(normal.headerCell, FONT_SIZE_PRESETS.normal.smallFontSize)
  assert.equal(normal.serviceHeading, FONT_SIZE_PRESETS.normal.headerFontSize)

  const small = organistaDocxFontSizes(
    resolveFontSizePreset({ ...DEFAULT_DOC_FORMAT, fontSize: 'small' }),
  )
  const large = organistaDocxFontSizes(
    resolveFontSizePreset({ ...DEFAULT_DOC_FORMAT, fontSize: 'large' }),
  )
  assert.ok(large.name > normal.name && normal.name > small.name)
  assert.ok(
    large.signatureName > normal.signatureName &&
      normal.signatureName > small.signatureName,
    'signature names scale with the preset, not a fixed 11 pt',
  )
  assert.ok(
    large.signatureRole > normal.signatureRole &&
      normal.signatureRole > small.signatureRole,
    'signature roles scale with the preset',
  )
  assert.ok(large.church > normal.church && normal.church > small.church)
  assert.ok(large.date > normal.date && normal.date > small.date)
})

test('a custom Organist Suguan size reaches the Word names and signatures', () => {
  const custom = resolveFontSizePreset({
    ...DEFAULT_DOC_FORMAT,
    fontSize: 'custom',
    customBodyFontSize: 14,
  })
  const sizes = organistaDocxFontSizes(custom)
  assert.equal(sizes.name, 14)
  assert.equal(sizes.signatureName, 14)
  assert.equal(sizes.signatureRole, custom.smallFontSize)
})
