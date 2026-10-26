import assert from 'node:assert/strict'
import test from 'node:test'

import type { Member } from '@/core/types/member'
import type {
  ExtraOccasionSuguanConfig,
  Suguan,
  SuguanDocFormat,
  VoicePosition,
} from '@/core/types/suguan'
import {
  computeSuguanLayout,
  createSuguanExcelBlob,
} from '@/lib/suguanExport'
import { createSuguanDocxBlob } from '@/features/suguan-builder/suguanDocxExport'
import {
  extraOccasionSheetHeading,
  extraOccasionNameHeader,
  normalizeDocFormat,
  suguanFileName,
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
  time: '15:00',
  serviceTypeId: 'Pagsamba',
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

test('an Extra Occasion uses the reference heading and voice-section table styling', () => {
  const occasionSheet = buildExtraOccasionSheetSuguan(
    suguan,
    [voice],
    [member],
    config,
  )
  const occasionLayout = computeSuguanLayout(
    occasionSheet,
    [member],
    A4_LANDSCAPE,
  )
  const choirLayout = computeSuguanLayout(
    suguan,
    [member],
    A4_LANDSCAPE,
  )

  assert.deepEqual(extraOccasionSheetHeading(occasionSheet), {
    locale: 'Lokal ng Sta. Monica',
    title: 'Kasal',
    subtitle: 'October 12, 2026 - 3:00 PM',
  })
  assert.equal(
    extraOccasionNameHeader(occasionSheet),
    'PANGALAN\nPagsamba',
  )
  assert.equal(
    extraOccasionSheetHeading({ ...occasionSheet, time: '12:00 AM' }).subtitle,
    'October 12, 2026 - 12:00 AM',
  )
  assert.equal(
    extraOccasionSheetHeading({
      ...occasionSheet,
      extraOccasion: { ...config, localeName: '' },
    }).locale,
    '',
  )
  assert.ok(occasionLayout.titleRowH > choirLayout.titleRowH)
  assert.match(suguanFileName(record, 'pdf'), / - Kasal Suguan\.pdf$/)
  assert.deepEqual(
    occasionLayout.sections.map(({ label, headingType }) => [
      label,
      headingType,
    ]),
    [
      ['Friday 3:00 PM', 'schedule'],
      ['SOPRANO', 'voice'],
    ],
  )
  assert.equal(occasionLayout.sections[0].rows.length, 0)
  assert.equal(occasionLayout.sections[1].rows[0].name, 'Andao, Kimberly')
})

test('the shared Word builder renders the adapted occasion sheet', async () => {
  const occasionSheet = buildExtraOccasionSheetSuguan(
    suguan,
    [voice],
    [member],
    config,
  )
  const blob = await createSuguanDocxBlob(occasionSheet, [member], {
    ...A4_LANDSCAPE,
    tableSpacingBeforePt: 2,
    tableSpacingAfterPt: 3,
  })

  assert.equal(
    blob.type,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  )
  assert.ok(blob.size > 0)
})

test('the shared Excel builder uses the reference occasion font and headings', async () => {
  const occasionSheet = buildExtraOccasionSheetSuguan(
    suguan,
    [voice],
    [member],
    config,
  )
  const blob = await createSuguanExcelBlob(
    occasionSheet,
    [member],
    A4_LANDSCAPE,
  )
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await blob.arrayBuffer())

  const sheet = workbook.worksheets[0]
  assert.equal(sheet.getCell('A1').value, 'Lokal ng Sta. Monica')
  assert.equal(sheet.getCell('A2').value, 'Kasal')
  assert.equal(sheet.getCell('A3').value, 'October 12, 2026 - 3:00 PM')
  assert.equal(sheet.getCell('A4').value, 'Blg.')
  assert.equal(sheet.getCell('B4').value, 'PANGALAN\nPagsamba')
  assert.equal(sheet.getCell('B4').alignment?.horizontal, 'center')
  assert.equal(sheet.getCell('C4').value, 'Pagsasanay\n10/11/2026')
  assert.match(JSON.stringify(sheet.getCell('B4').fill), /FFFFF2CC/)
  assert.match(JSON.stringify(sheet.getCell('C4').fill), /FFFFF2CC/)
  assert.match(JSON.stringify(sheet.getCell('D4').fill), /FFFFF2CC/)
  assert.equal(sheet.getRow(4).height, 15)
  assert.equal(sheet.getCell('B7').value, 'SOPRANO')
  assert.equal(sheet.getCell('B6').value, 'FRIDAY 3:00 PM')
  assert.match(JSON.stringify(sheet.getCell('B6').fill), /FFFFF2CC/)
  assert.equal(sheet.getCell('B7').font?.size, 12)
  assert.equal(sheet.getCell('B7').font?.name, 'Book Antiqua')
  assert.equal(sheet.getCell('B8').value, 'Andao, Kimberly')
  assert.equal(sheet.getCell('A8').font?.size, 9)
  assert.ok(Number(sheet.getCell('B8').font?.size) > 9)
  assert.equal(sheet.getCell('B8').font?.size, 13)
  assert.equal(sheet.getCell('B8').font?.name, 'Book Antiqua')
})
