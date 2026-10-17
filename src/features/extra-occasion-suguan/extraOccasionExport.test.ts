import assert from 'node:assert/strict'
import test from 'node:test'

import type { Member } from '@/core/types/member'
import type {
  ExtraOccasionSuguanConfig,
  Suguan,
  SuguanDocFormat,
  VoicePosition,
} from '@/core/types/suguan'
import { computeSuguanLayout, type SuguanSheetLayout } from '@/lib/suguanExport'
import { createSuguanDocxBlob } from '@/features/suguan-builder/suguanDocxExport'
import {
  DEFAULT_DOC_FORMAT,
  normalizeDocFormat,
} from '@/lib/suguanUtils'
import { buildExtraOccasionSheetSuguan } from './extraOccasionData.ts'
import { extraOccasionExportOptionsForRecord } from './extraOccasionExport.ts'

const member: Member = {
  id: 'member-1',
  firstName: 'Kimberly',
  lastName: 'Andao',
  gender: 'female',
  voicePosition: 'soprano-1',
  membershipType: 'regular',
  isActive: true,
  dateAdded: '2026-01-01',
  positions: ['pangulong-mang-aawit'],
}

const voice: VoicePosition = {
  id: 'soprano-1',
  name: 'Soprano',
  shortName: 'S',
  gender: 'female',
}

const suguan: Suguan = {
  id: 'extra-1',
  date: '',
  time: '',
  serviceTypeId: '',
  group: 'babae',
  events: [],
  schedules: [
    {
      id: 'schedule-1',
      scheduleLabel: 'Friday 3:00 PM',
      scheduleDay: 'Friday',
      scheduleTime: '3:00 PM',
      assignments: [
        {
          memberId: member.id,
          memberName: 'Kimberly Andao',
          voicePosition: voice.id,
          assignedAt: '',
        },
      ],
    },
  ],
  voiceCapacities: {},
  assignments: [],
  dutyRoles: [],
  destinadoName: 'Juan Dela Cruz',
  createdAt: '',
  updatedAt: '',
}

const config: ExtraOccasionSuguanConfig = {
  name: 'Kasal',
  localeName: 'Sta. Monica',
  pagsasanay: { enabled: true, label: 'Pagsasanay', date: '2026-10-11' },
  pagtupad: { enabled: true, label: 'Pagtupad', date: '2026-10-12' },
  showFooterSignatories: true,
  organistaAssignments: {},
}

/** A saved Extra Occasion, as Suguan History reads one back. */
const record: Suguan = { ...suguan, extraOccasion: config }

const A4_LANDSCAPE: SuguanDocFormat = {
  paperSize: 'a4',
  orientation: 'landscape',
  margins: 'narrow',
  scaling: 'fit-width',
  fontSize: 'large',
}

test('extraOccasionExportOptionsForRecord reads the occasion off the record', () => {
  const options = extraOccasionExportOptionsForRecord(record, [member], [voice])

  assert.equal(options.suguan, record)
  assert.equal(options.localeName, 'Sta. Monica')
  assert.deepEqual(options.pagsasanay, config.pagsasanay)
  assert.deepEqual(options.pagtupad, config.pagtupad)
  assert.deepEqual(options.organistaAssignments, {})
  assert.equal(options.showFooterSignatories, true)
  // A record with no saved document setup takes the same default a Choir Suguan
  // sheet does.
  assert.deepEqual(options.docFormat, normalizeDocFormat(undefined))
})

test('extraOccasionExportOptionsForRecord keeps the record document setup', () => {
  const options = extraOccasionExportOptionsForRecord(
    { ...record, docFormat: A4_LANDSCAPE },
    [member],
    [voice],
  )

  assert.deepEqual(options.docFormat, normalizeDocFormat(A4_LANDSCAPE))
})

test('extraOccasionExportOptionsForRecord refuses a plain Choir Suguan', () => {
  assert.throws(
    () => extraOccasionExportOptionsForRecord(suguan, [member], [voice]),
    /does not have Extra Occasion settings/,
  )
})

/**
 * Every value the shared preview, PDF, Excel and Word renderers read for fonts,
 * rows, columns and the signature block. None of it depends on the sheet's
 * content, so an occasion sheet must produce the Choir Suguan numbers exactly.
 */
function sheetStyling(layout: SuguanSheetLayout) {
  return {
    format: layout.fmt,
    paper: [layout.paperWidthMm, layout.paperHeightMm],
    margins: layout.margins,
    fonts: layout.fs,
    rowHeights: [
      layout.titleRowH,
      layout.headerRowH,
      layout.globalHeaderBlockH,
      layout.sectionLabelRowH,
    ],
    table: [layout.headerTopY, layout.topBlockH, layout.usableTableH],
    signature: layout.sig,
  }
}

test('an Extra Occasion sheet is styled exactly like a Choir Suguan sheet', () => {
  const occasionSheet = buildExtraOccasionSheetSuguan(
    suguan,
    [voice],
    [member],
    config,
  )

  for (const docFormat of [DEFAULT_DOC_FORMAT, A4_LANDSCAPE]) {
    assert.deepEqual(
      sheetStyling(computeSuguanLayout(occasionSheet, [member], docFormat)),
      sheetStyling(computeSuguanLayout({ ...suguan }, [member], docFormat)),
    )
  }
})

test('the shared Word builder renders the adapted occasion sheet', async () => {
  const occasionSheet = buildExtraOccasionSheetSuguan(
    suguan,
    [voice],
    [member],
    config,
  )
  const blob = await createSuguanDocxBlob(occasionSheet, [member])

  assert.equal(
    blob.type,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  )
  assert.ok(blob.size > 0)
})
