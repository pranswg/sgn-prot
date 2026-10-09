import Papa from 'papaparse'
import type { Member, Trainee } from '@/core/types/member'
import {
  getVoiceName,
  UNASSIGNED_VOICE_ID,
} from '@/core/constants/voicePositions'
import { positionSummary } from '@/core/constants/choirPositions'
import { MEMBERSHIP_LABELS, memberEffectivePositions } from '@/core/constants/memberMembership'
import { useSettingsStore } from '@/store/settingsStore'
import type { VoicePosition, DutyRole } from '@/core/types/suguan'
import {
  MASTER_LIST_PAPER_SIZES,
  type MasterListPaperSize,
} from '@/features/master-list/masterListPaperSizes'
import {
  groupMasterListPdfSections,
  masterListPdfName,
  masterListPdfPosition,
  sortMasterListPdfMembers,
  splitMasterListPdfSections,
  summarizeMasterList,
} from '@/lib/masterListPdfData'

function voiceName(id: string): string {
  return getVoiceName(id, useSettingsStore.getState().allVoices())
}

export const MASTER_LIST_SPREADSHEET_HEADERS = [
  'Blg.',
  'First Name',
  'Middle Name',
  'Last Name',
  'Suffix',
  'Gender',
  'Voice Position',
  'Positions / Privileges',
  'Duty Roles',
  'Membership Type',
  'Status',
  'Date Added',
  'Notes',
] as const

export type MasterListSpreadsheetRow = string[]

function memberSpreadsheetRow(
  member: Member,
  index: number,
  voices: VoicePosition[],
  dutyRoles: DutyRole[],
): string[] {
  const roles = (member.assignedDutyRoleIds ?? [])
    .map((id) => dutyRoles.find((role) => role.id === id)?.name)
    .filter((name): name is string => Boolean(name))
  return [
    `${index + 1}.`,
    member.firstName,
    member.middleName ?? '',
    member.lastName,
    member.suffix ?? '',
    member.gender === 'female' ? 'Female' : 'Male',
    getVoiceName(member.voicePosition, voices),
    masterListPdfPosition(member, dutyRoles),
    roles.join(', '),
    MEMBERSHIP_LABELS[member.membershipType],
    member.isActive ? 'Active' : 'Inactive',
    member.dateAdded,
    member.notes ?? '',
  ]
}

/** Builds sectioned spreadsheet data using the PDF's section order and grouping. */
export function masterListToSpreadsheetRows(
  members: Member[],
  trainees: Trainee[],
  voices: VoicePosition[],
  dutyRoles: DutyRole[],
  localeName: string,
): MasterListSpreadsheetRow[] {
  const sections = groupMasterListPdfSections(
    members,
    trainees,
    localeName,
    dutyRoles,
  )
  const rows: MasterListSpreadsheetRow[] = [['MASTER LIST']]

  for (const section of sections) {
    if (section.kind === 'members' && section.members.length === 0) continue
    if (section.kind === 'trainees' && section.trainees.length === 0) continue
    rows.push([section.title])
    rows.push([...MASTER_LIST_SPREADSHEET_HEADERS])

    if (section.kind === 'members') {
      sortMasterListPdfMembers(section.members, voices, section.order).forEach(
        (member, index) =>
          rows.push(memberSpreadsheetRow(member, index, voices, dutyRoles)),
      )
    } else {
      section.trainees.forEach((trainee, index) => {
        rows.push([
          `${index + 1}.`,
          trainee.firstName,
          trainee.middleName ?? '',
          trainee.lastName,
          trainee.suffix ?? '',
          trainee.gender === 'female' ? 'Female' : 'Male',
          getVoiceName(trainee.voicePosition, voices),
          'Nagsasanay',
          '',
          '',
          trainee.status === 'active' ? 'Active' : 'Inactive',
          trainee.dateAdded,
          trainee.notes ?? '',
        ])
      })
    }
  }

  return rows
}

export interface MemberExportRow {
  'First Name': string
  'Last Name': string
  'Middle Name': string
  Suffix: string
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
    Suffix: m.suffix ?? '',
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

export function exportCSVRows(
  rows: readonly (readonly string[])[],
  filename: string,
): void {
  const csv = Papa.unparse(rows.map((row) => [...row]))
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

export async function exportMasterListExcel(
  rows: readonly (readonly string[])[],
  filename: string,
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Master List')
  const headers = [...MASTER_LIST_SPREADSHEET_HEADERS]
  const titleFont = { name: 'Book Antiqua', size: 16, bold: true }
  const sectionFill = {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FFF2F2F2' },
  }
  const columnCount = headers.length

  rows.forEach((row) => {
    const worksheetRow = sheet.addRow([...row])
    const firstCell = row[0] ?? ''
    if (firstCell === 'MASTER LIST') {
      sheet.mergeCells(worksheetRow.number, 1, worksheetRow.number, columnCount)
      worksheetRow.font = titleFont
      worksheetRow.alignment = { horizontal: 'center' }
      worksheetRow.height = 26
    } else if (isMasterListSectionRow(firstCell)) {
      sheet.mergeCells(worksheetRow.number, 1, worksheetRow.number, columnCount)
      worksheetRow.font = { name: 'Book Antiqua', size: 12, bold: true }
      worksheetRow.fill = sectionFill
      worksheetRow.height = 21
    } else if (firstCell === MASTER_LIST_SPREADSHEET_HEADERS[0]) {
      worksheetRow.font = { name: 'Book Antiqua', bold: true }
      worksheetRow.fill = sectionFill
      worksheetRow.alignment = { horizontal: 'center', vertical: 'middle' }
      worksheetRow.height = 22
    } else {
      worksheetRow.font = { name: 'Book Antiqua', size: 10 }
    }
  })

  sheet.columns = headers.map((_, index) => ({
    key: String(index),
    width: [8, 18, 18, 20, 10, 12, 18, 29, 24, 20, 12, 15, 28][index] ?? 16,
  }))
  sheet.views = [{ state: 'frozen', ySplit: 3 }]
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFB8B8B8' } },
        left: { style: 'thin', color: { argb: 'FFB8B8B8' } },
        bottom: { style: 'thin', color: { argb: 'FFB8B8B8' } },
        right: { style: 'thin', color: { argb: 'FFB8B8B8' } },
      }
    })
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

export async function exportMasterListWord(
  members: Member[],
  trainees: Trainee[],
  voices: VoicePosition[],
  dutyRoles: DutyRole[],
  localeName: string,
  paperSize: MasterListPaperSize,
  filename: string,
): Promise<void> {
  const blob = await createMasterListWordBlob(
    members,
    trainees,
    voices,
    dutyRoles,
    localeName,
    paperSize,
  )
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function createMasterListWordBlob(
  members: Member[],
  trainees: Trainee[],
  voices: VoicePosition[],
  dutyRoles: DutyRole[],
  localeName: string,
  paperSize: MasterListPaperSize = 'legal',
): Promise<Blob> {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    Footer,
    PageOrientation,
    Packer,
    Paragraph,
    SimpleField,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TabStopType,
    TextRun,
    WidthType,
  } = await import('docx')
  const border = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: '000000',
  }
  const borders = {
    top: border,
    bottom: border,
    left: border,
    right: border,
    insideHorizontal: border,
    insideVertical: border,
  }
  const paper = MASTER_LIST_PAPER_SIZES.find(({ id }) => id === paperSize)
  if (!paper) throw new Error('The selected paper size is not supported.')
  const pageWidthTwips = Math.round((paper.width * 1440) / 25.4)
  const pageHeightTwips = Math.round((paper.height * 1440) / 25.4)
  const marginTwips = 760
  const contentWidth = pageWidthTwips - marginTwips * 2
  const columnShares = [60, 220, 96, 78, 120]
  const shareTotal = columnShares.reduce((total, share) => total + share, 0)
  const columnWidths = columnShares.map((share) =>
    Math.round((contentWidth * share) / shareTotal),
  )
  const tableWidth = columnWidths.reduce((total, width) => total + width, 0)
  const tableHeaders = ['Blg.', 'Pangalan', 'Voice', 'Status', 'Position']
  const sections = groupMasterListPdfSections(
    members,
    trainees,
    localeName,
    dutyRoles,
  )
  const { contentSections, hierarchySections } =
    splitMasterListPdfSections(sections)
  const summaryDetails = summarizeMasterList(members, trainees, voices)
  const children = []

  const makeParagraph = (
    text: string,
    options: {
      align?: (typeof AlignmentType)[keyof typeof AlignmentType]
      font?: string
      size?: number
      bold?: boolean
      color?: string
      before?: number
      after?: number
    } = {},
  ) =>
    new Paragraph({
      alignment: options.align ?? AlignmentType.LEFT,
      spacing: { before: options.before ?? 0, after: options.after ?? 0 },
      children: [
        new TextRun({
          text,
          font: options.font ?? 'Book Antiqua',
          size: options.size ?? 20,
          bold: options.bold ?? false,
          color: options.color ?? '000000',
        }),
      ],
    })

  const makeCell = (
    text: string,
    width: number,
    options: {
      fill?: string
      bold?: boolean
      size?: number
      color?: string
      align?: (typeof AlignmentType)[keyof typeof AlignmentType]
      margins?: { top: number; bottom: number; left: number; right: number }
      columnSpan?: number
    } = {},
  ) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      ...(options.columnSpan ? { columnSpan: options.columnSpan } : {}),
      ...(options.fill
        ? {
            shading: {
              fill: options.fill,
              color: options.fill,
              type: 'clear' as const,
            },
          }
        : {}),
      margins: options.margins ?? {
        top: 80,
        bottom: 80,
        left: 100,
        right: 100,
      },
      verticalAlign: 'center',
      children: [
        makeParagraph(text, {
          align: options.align ?? AlignmentType.CENTER,
          size: options.size ?? 20,
          bold: options.bold,
          color: options.color,
        }),
      ],
    })

  const makeRosterTable = (title: string, body: string[][]) =>
    new Table({
      width: { size: tableWidth, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      borders,
      rows: [
        new TableRow({
          tableHeader: true,
          cantSplit: true,
          children: [
            makeCell(title, tableWidth, {
              columnSpan: tableHeaders.length,
              fill: 'F2F2F2',
              bold: true,
              size: 22,
              align: AlignmentType.LEFT,
            }),
          ],
        }),
        new TableRow({
          tableHeader: true,
          cantSplit: true,
          children: tableHeaders.map((header, index) =>
            makeCell(header, columnWidths[index], { bold: true }),
          ),
        }),
        ...body.map(
          (values) =>
            new TableRow({
              cantSplit: true,
              children: tableHeaders.map((header, index) => {
                const value = values[index] ?? ''
                const color =
                  header === 'Status'
                    ? value === 'Active'
                      ? '166534'
                      : value === 'Inactive'
                        ? 'B91C1C'
                        : '000000'
                    : '000000'
                return makeCell(value, columnWidths[index], {
                  color,
                  align:
                    index === 1 ? AlignmentType.LEFT : AlignmentType.CENTER,
                })
              }),
            }),
        ),
      ],
    })

  const rosterRows = (section: (typeof contentSections)[number]) =>
    section.kind === 'members'
      ? sortMasterListPdfMembers(section.members, voices, section.order).map(
          (member, index) => [
            `${index + 1}.`,
            masterListPdfName(member),
            getVoiceName(member.voicePosition, voices),
            member.isActive ? 'Active' : 'Inactive',
            masterListPdfPosition(member, dutyRoles),
          ],
        )
      : section.trainees.map((trainee, index) => [
          `${index + 1}.`,
          masterListPdfName(trainee),
          trainee.voicePosition === UNASSIGNED_VOICE_ID
            ? 'Unassigned'
            : getVoiceName(trainee.voicePosition, voices),
          trainee.status === 'active' ? 'Active' : 'Inactive',
          'Nagsasanay',
        ])

  children.push(
    makeParagraph('MASTER LIST', {
      align: AlignmentType.CENTER,
      font: 'Segoe Script',
      size: 42,
      after: 140,
    }),
  )
  for (const section of contentSections) {
    children.push(makeRosterTable(section.title, rosterRows(section)))
    children.push(new Paragraph({ text: '', spacing: { after: 360 } }))
  }

  children.push(
    new Paragraph({
      pageBreakBefore: true,
      alignment: AlignmentType.CENTER,
      spacing: { after: 140 },
      children: [
        new TextRun({
          text: 'PANGULUHAN',
          font: 'Segoe Script',
          size: 40,
        }),
      ],
    }),
  )
  if (hierarchySections.length > 0) {
    for (const section of hierarchySections) {
      const body = sortMasterListPdfMembers(
        section.members,
        voices,
        section.order,
      ).map((member, index) => [
        `${index + 1}.`,
        masterListPdfName(member),
        getVoiceName(member.voicePosition, voices),
        member.isActive ? 'Active' : 'Inactive',
        masterListPdfPosition(member, dutyRoles),
      ])
      children.push(makeRosterTable(section.title, body))
      children.push(new Paragraph({ text: '', spacing: { after: 360 } }))
    }
  }

  const summaryColumnWidths = [tableWidth - 1520, 1520]
  const summaryHeader = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: ['MASTER LIST SUMMARY', 'COUNT'].map((text, index) =>
      makeCell(text, summaryColumnWidths[index], {
        bold: true,
        size: 24,
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
      }),
    ),
  })
  const summaryRows = summaryDetails.map((row) => {
    const isSection = row.kind === 'section'
    return new TableRow({
      cantSplit: true,
      children: [
        makeCell(row.category, summaryColumnWidths[0], {
          fill: isSection ? 'F2F2F2' : undefined,
          bold: isSection,
          size: 24,
          align: AlignmentType.LEFT,
          margins: { top: 120, bottom: 120, left: 160, right: 160 },
        }),
        makeCell(
          row.kind === 'item' ? String(row.count) : '',
          summaryColumnWidths[1],
          {
            fill: isSection ? 'F2F2F2' : undefined,
            bold: isSection,
            size: 24,
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
          },
        ),
      ],
    })
  })
  children.push(
    new Paragraph({
      pageBreakBefore: true,
      includeIfEmpty: true,
      text: '',
    }),
    new Table({
      width: { size: tableWidth, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      borders,
      rows: [summaryHeader, ...summaryRows],
      columnWidths: summaryColumnWidths,
    }),
  )

  const timestampNow = new Date()
  const timestampDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(timestampNow)
  const timestampTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  }).format(timestampNow)
  const footer = new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: tableWidth }],
    children: [
      new TextRun({
        text: `As of ${timestampDate} - ${timestampTime}\tPage `,
        font: 'Book Antiqua',
        size: 16,
      }),
      new SimpleField('PAGE', '1'),
      new TextRun({ text: ' of ', font: 'Book Antiqua', size: 16 }),
      new SimpleField('NUMPAGES'),
    ],
  })

  const doc = new Document({
    features: { updateFields: true },
    styles: {
      default: {
        document: {
          run: {
            font: 'Book Antiqua',
            size: 20,
          },
        },
      },
    },
    sections: [
      {
        footers: { default: new Footer({ children: [footer] }) },
        properties: {
          page: {
            size: {
              width: pageWidthTwips,
              height: pageHeightTwips,
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: marginTwips,
              right: marginTwips,
              bottom: 560,
              left: marginTwips,
              footer: 320,
            },
          },
        },
        children,
      },
    ],
  })
  return Packer.toBlob(doc)
}

function isMasterListSectionRow(value: string): boolean {
  return value.startsWith('SECTION: ') || value.toUpperCase().includes(' CHOIR - ')
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