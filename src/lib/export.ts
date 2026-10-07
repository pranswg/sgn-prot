import Papa from 'papaparse'
import type { Member, Trainee } from '@/core/types/member'
import { getVoiceName } from '@/core/constants/voicePositions'
import { positionSummary } from '@/core/constants/choirPositions'
import { MEMBERSHIP_LABELS, memberEffectivePositions } from '@/core/constants/memberMembership'
import { useSettingsStore } from '@/store/settingsStore'

function voiceName(id: string): string {
  return getVoiceName(id, useSettingsStore.getState().allVoices())
}

export interface MemberExportRow {
  'First Name': string
  'Last Name': string
  'Middle Name': string
  Gender: string
  'Voice Position': string
  'Positions / Privileges': string
  'Membership Type': string
  Status: string
  'Date Added': string
  Notes: string
}

export function membersToRows(members: Member[]): MemberExportRow[] {
  return members.map((m) => ({
    'First Name': m.firstName,
    'Last Name': m.lastName,
    'Middle Name': m.middleName ?? '',
    Gender: m.gender,
    'Voice Position': voiceName(m.voicePosition),
    'Positions / Privileges': positionSummary(memberEffectivePositions(m)),
    'Membership Type': MEMBERSHIP_LABELS[m.membershipType],
    Status: m.isActive ? 'Active' : 'Inactive',
    'Date Added': m.dateAdded,
    Notes: m.notes ?? '',
  }))
}

export function traineesToRows(trainees: Trainee[]) {
  return trainees.map((t) => ({
    'First Name': t.firstName,
    'Last Name': t.lastName,
    Gender: t.gender,
    'Voice Position': voiceName(t.voicePosition),
    Status: t.status,
    'Date Added': t.dateAdded,
    Notes: t.notes ?? '',
  }))
}

export function exportCSV(
  rows: Record<string, string | number>[],
  filename: string,
) {
  const csv = Papa.unparse(rows)
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function exportExcel(
  rows: Record<string, string | number>[],
  filename: string,
  sheetName = 'Master List',
) {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName)
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  sheet.addRow(headers)
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8E8E8' },
    }
  })
  for (const row of rows) {
    sheet.addRow(headers.map((h) => row[h] ?? ''))
  }
  sheet.columns.forEach((col) => {
    let maxLength = 0
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const value = cell.value ? String(cell.value).length : 0
      maxLength = Math.max(maxLength, value)
    })
    col.width = Math.min(Math.max(maxLength + 2, 10), 40)
  })
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}