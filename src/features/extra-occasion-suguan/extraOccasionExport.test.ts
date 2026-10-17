import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import type { Member } from '@/core/types/member'
import type { Suguan, VoicePosition } from '@/core/types/suguan'
import { DEFAULT_DOC_FORMAT } from '@/lib/suguanUtils'
import {
  createExtraOccasionDocxBlob,
  createExtraOccasionExcelBlob,
  createExtraOccasionPdfBlob,
  type ExtraOccasionExportOptions,
} from './extraOccasionExport.ts'

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

const options: ExtraOccasionExportOptions = {
  suguan,
  members: [member],
  voices: [voice],
  organistaAssignments: {},
  pagsasanay: {
    enabled: true,
    label: 'Pagsasanay',
    date: '2026-10-11',
  },
  pagtupad: {
    enabled: true,
    label: 'Pagtupad',
    date: '2026-10-12',
  },
  showFooterSignatories: true,
  localeName: 'Sta. Monica',
  docFormat: DEFAULT_DOC_FORMAT,
}

test('Extra Occasion PDF, Excel, and Word builders produce export blobs', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : input.toString()
    if (url.startsWith('file:')) {
      return new Response(await readFile(fileURLToPath(url)))
    }
    return originalFetch(input, init)
  }
  let blobs: [Blob, Blob, Blob]
  try {
    blobs = await Promise.all([
      createExtraOccasionPdfBlob(options),
      createExtraOccasionExcelBlob(options),
      createExtraOccasionDocxBlob(options),
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
  const [pdf, excel, docx] = blobs

  assert.equal(pdf.type, 'application/pdf')
  assert.equal(
    excel.type,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  assert.equal(
    docx.type,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  )
  assert.ok(pdf.size > 0)
  assert.ok(excel.size > 0)
  assert.ok(docx.size > 0)
})

test('Extra Occasion Excel uses the Choir Suguan font and document font sizes', async () => {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const excel = await createExtraOccasionExcelBlob(options)
  await workbook.xlsx.load(await excel.arrayBuffer())
  const sheet = workbook.worksheets[0]

  assert.equal(sheet.getCell('A1').font?.name, 'Inter')
  assert.equal(sheet.getCell('A1').font?.size, 9)
  assert.equal(sheet.getCell('A2').font?.name, 'Inter')
  assert.equal(sheet.getCell('A2').font?.size, 12)
  assert.equal(sheet.getCell('A3').font?.name, 'Inter')
  assert.equal(sheet.getCell('A3').font?.size, 9)
  assert.equal(sheet.getCell('B6').font?.name, 'Inter')
  assert.equal(sheet.getCell('B6').font?.size, 9)
})
