import type { Choir, Member, Trainee } from '@/core/types/member'
import type {
  DocScaling,
  SuguanDocFormat,
  VoicePosition,
} from '@/core/types/suguan'
import { sortMasterListPdfMembers } from '@/lib/masterListPdfData'
import { formatDateKeyLongDate, type DateKey } from '@/lib/phDate'
import { clampCustomBodyFontSize } from '@/lib/suguanUtils'

export type MasterListAttendanceRow =
  | { kind: 'section'; label: string }
  | { kind: 'member'; member: Member; name: string; number: number }
  | { kind: 'trainee'; name: string; number: number }
  | { kind: 'page-break' }

export type MasterListAttendancePageRow = Exclude<
  MasterListAttendanceRow,
  { kind: 'page-break' }
>

export function formatAttendanceDateSummary(dates: readonly DateKey[]): string {
  const uniqueDates = [...new Set(dates)].sort((left, right) =>
    left.localeCompare(right),
  )
  const datesByMonth = new Map<string, DateKey[]>()

  for (const date of uniqueDates) {
    const monthKey = date.slice(0, 7)
    const monthDates = datesByMonth.get(monthKey) ?? []
    monthDates.push(date)
    datesByMonth.set(monthKey, monthDates)
  }

  return [...datesByMonth.values()]
    .map((monthDates) => {
      if (monthDates.length === 1) {
        return formatDateKeyLongDate(monthDates[0])
      }
      const year = monthDates[0].slice(0, 4)
      const monthName = formatDateKeyLongDate(monthDates[0]).split(' ')[0]
      const dayList = monthDates.map((date) =>
        String(Number(date.slice(8, 10))),
      )
      return `${monthName} ${dayList.join(', ')}, ${year}`
    })
    .join('; ')
}

export interface MasterListAttendanceFirstPage {
  height: number
  finalHeight: number
}

export function paginateMasterListAttendanceRows(
  rows: MasterListAttendanceRow[],
  regularPageHeight: number,
  finalPageHeight: number,
  memberRowHeight = 26,
  sectionRowHeight = 22,
  firstPage?: MasterListAttendanceFirstPage,
): MasterListAttendancePageRow[][] {
  const heightOf = (row: MasterListAttendanceRow) =>
    row.kind === 'section'
      ? sectionRowHeight
      : row.kind === 'page-break'
        ? 0
        : memberRowHeight
  const totalHeight = (items: MasterListAttendanceRow[]) =>
    items.reduce((height, row) => height + heightOf(row), 0)

  const pages: MasterListAttendancePageRow[][] = []
  let offset = 0
  let currentSection: string | undefined

  while (offset < rows.length) {
    const pageHeight =
      pages.length === 0 && firstPage ? firstPage.height : regularPageHeight
    const pageFinalHeight =
      pages.length === 0 && firstPage ? firstPage.finalHeight : finalPageHeight
    const continuation =
      currentSection &&
      rows[offset].kind !== 'section' &&
      rows[offset].kind !== 'page-break'
        ? [{ kind: 'section' as const, label: currentSection }]
        : []
    const finalPageRows = [...continuation, ...rows.slice(offset)]
    const hasPageBreak = rows
      .slice(offset)
      .some((row) => row.kind === 'page-break')
    if (!hasPageBreak && totalHeight(finalPageRows) <= pageFinalHeight) {
      pages.push(
        finalPageRows.filter(
          (row): row is MasterListAttendancePageRow =>
            row.kind !== 'page-break',
        ),
      )
      break
    }

    const pageRows: MasterListAttendancePageRow[] = [...continuation]
    let usedHeight = totalHeight(continuation)
    const pageStart = offset
    while (offset < rows.length) {
      const row = rows[offset]
      if (row.kind === 'page-break') {
        offset += 1
        currentSection = undefined
        if (pageRows.length > 0) break
        continue
      }
      const rowHeight = heightOf(row)
      if (usedHeight + rowHeight > pageHeight) break
      pageRows.push(row)
      usedHeight += rowHeight
      offset += 1
      if (row.kind === 'section') currentSection = row.label
    }

    if (offset === pageStart) {
      throw new Error('Attendance page height is too small to fit a roster row.')
    }
    pages.push(pageRows)
  }

  return pages
}

function formatAttendanceName(
  person: Member | Trainee,
  lastNameFirst: boolean,
): string {
  const givenNames = [person.firstName, person.middleName]
    .filter(Boolean)
    .join(' ')
  const name = lastNameFirst
    ? [person.lastName, givenNames].filter(Boolean).join(', ')
    : [givenNames, person.lastName].filter(Boolean).join(' ')
  return [name, person.suffix].filter(Boolean).join(' ')
}

function sortTrainees(trainees: Trainee[]): Trainee[] {
  return [...trainees].sort(
    (left, right) =>
      left.lastName.localeCompare(right.lastName) ||
      left.firstName.localeCompare(right.firstName) ||
      left.id.localeCompare(right.id),
  )
}

interface AttendanceCounter {
  value: number
}

function memberRows(
  items: Member[],
  voices: VoicePosition[],
  lastNameFirst: boolean,
  counter: AttendanceCounter,
): MasterListAttendanceRow[] {
  return sortMasterListPdfMembers(items, voices, 'name').map((member) => ({
    kind: 'member',
    member,
    name: formatAttendanceName(member, lastNameFirst),
    number: ++counter.value,
  }))
}

function traineeSection(
  trainees: Trainee[],
  gender: Trainee['gender'],
  include: boolean,
  lastNameFirst: boolean,
  counter: AttendanceCounter,
): MasterListAttendanceRow[] {
  if (!include) return []
  const selected = sortTrainees(
    trainees.filter(
      (trainee) => trainee.status === 'active' && trainee.gender === gender,
    ),
  )
  if (selected.length === 0) return []
  return [
    {
      kind: 'section',
      label: gender === 'female' ? 'Nagsasanay Women' : 'Nagsasanay Men',
    },
    ...selected.map((trainee) => ({
      kind: 'trainee' as const,
      name: formatAttendanceName(trainee, lastNameFirst),
      number: ++counter.value,
    })),
  ]
}

/** PNK always reads Babae then Lalaki, members and trainees interleaved. */
function pnkRows(
  members: Member[],
  trainees: Trainee[],
  includeNagsasanayMen: boolean,
  includeNagsasanayWomen: boolean,
  lastNameFirst: boolean,
): MasterListAttendanceRow[] {
  const counter: AttendanceCounter = { value: 0 }
  return (['female', 'male'] as const).flatMap((gender) => {
    const genderMembers = members.filter((member) => member.gender === gender)
    const includeTrainees =
      gender === 'male' ? includeNagsasanayMen : includeNagsasanayWomen
    const genderTrainees = includeTrainees
      ? sortTrainees(
          trainees.filter(
            (trainee) =>
              trainee.status === 'active' && trainee.gender === gender,
          ),
        )
      : []
    const people: (
      | { person: Member; kind: 'member' }
      | { person: Trainee; kind: 'trainee' }
    )[] = [
      ...genderMembers.map((person) => ({
        person,
        kind: 'member' as const,
      })),
      ...genderTrainees.map((person) => ({
        person,
        kind: 'trainee' as const,
      })),
    ].sort(
      (left, right) =>
        left.person.lastName.localeCompare(right.person.lastName) ||
        left.person.firstName.localeCompare(right.person.firstName) ||
        left.person.id.localeCompare(right.person.id),
    )
    if (people.length === 0) return []
    return [
      {
        kind: 'section' as const,
        label: gender === 'female' ? 'Babae' : 'Lalaki',
      },
      ...people.map(({ person, kind }) =>
        kind === 'member'
          ? {
              kind,
              member: person,
              name: formatAttendanceName(person, lastNameFirst),
              number: ++counter.value,
            }
          : {
              kind,
              name: formatAttendanceName(person, lastNameFirst),
              number: ++counter.value,
            },
      ),
    ]
  })
}

export function buildMasterListAttendanceRows(
  members: Member[],
  voices: VoicePosition[],
  selectedVoiceIds: readonly string[] | null,
  trainees: Trainee[] = [],
  includeNagsasanayMen = false,
  includeNagsasanayWomen = false,
  lastNameFirst = false,
  choir: Choir = 'aws',
): MasterListAttendanceRow[] {
  const activeMembers = members.filter((member) => member.isActive)
  const counter: AttendanceCounter = { value: 0 }

  if (choir === 'pnk') {
    return pnkRows(
      activeMembers,
      trainees,
      includeNagsasanayMen,
      includeNagsasanayWomen,
      lastNameFirst,
    )
  }

  if (selectedVoiceIds !== null) {
    const voiceRows = voices
      .filter((voice) => selectedVoiceIds.includes(voice.id))
      .flatMap((voice) => {
        const assigned = activeMembers.filter(
          (member) => member.voicePosition === voice.id,
        )
        if (assigned.length === 0) return []
        return [
          { kind: 'section' as const, label: voice.name },
          ...memberRows(assigned, voices, lastNameFirst, counter),
        ]
      })

    return [
      ...voiceRows,
      ...traineeSection(
        trainees,
        'male',
        includeNagsasanayMen,
        lastNameFirst,
        counter,
      ),
      ...traineeSection(
        trainees,
        'female',
        includeNagsasanayWomen,
        lastNameFirst,
        counter,
      ),
    ]
  }

  return (['female', 'male'] as const).flatMap((gender, index) => {
    const includeTrainees =
      gender === 'male' ? includeNagsasanayMen : includeNagsasanayWomen
    const genderMembers = activeMembers.filter(
      (member) => member.gender === gender,
    )
    const genderTrainees = includeTrainees
      ? sortTrainees(
          trainees.filter(
            (trainee) =>
              trainee.status === 'active' && trainee.gender === gender,
          ),
        )
      : []
    if (genderMembers.length === 0 && genderTrainees.length === 0) return []
    return [
      ...(index > 0 ? [{ kind: 'page-break' as const }] : []),
      {
        kind: 'section' as const,
        label: gender === 'female' ? 'Women' : 'Men',
      },
      ...memberRows(genderMembers, voices, lastNameFirst, counter),
      ...(genderTrainees.length > 0
        ? [
            {
              kind: 'section' as const,
              label:
                gender === 'female' ? 'Nagsasanay Women' : 'Nagsasanay Men',
            },
            ...genderTrainees.map((trainee) => ({
              kind: 'trainee' as const,
              name: formatAttendanceName(trainee, lastNameFirst),
              number: ++counter.value,
            })),
          ]
        : []),
    ]
  })
}

/**
 * One printed attendance sheet. A separated sheet carries the choir name that
 * prints under the dates; the combined sheet has an empty label.
 */
export interface MasterListAttendanceSheet {
  label: string
  rows: MasterListAttendanceRow[]
}

/**
 * The sheet list the renderers paginate. With `separateChoirs` off (the
 * default) there is one sheet, built exactly as before. With it on, AWS splits
 * into a Babae sheet (women + Nagsasanay Women) and a Lalaki sheet (men +
 * Nagsasanay Men); each numbers its own roster and is skipped when empty. PNK
 * already reads Babae then Lalaki, so it stays one sheet.
 */
export function buildMasterListAttendanceSheets(
  members: Member[],
  voices: VoicePosition[],
  selectedVoiceIds: readonly string[] | null,
  trainees: Trainee[] = [],
  includeNagsasanayMen = false,
  includeNagsasanayWomen = false,
  lastNameFirst = false,
  choir: Choir = 'aws',
  separateChoirs = false,
): MasterListAttendanceSheet[] {
  if (!separateChoirs || choir === 'pnk') {
    return [
      {
        label: '',
        rows: buildMasterListAttendanceRows(
          members,
          voices,
          selectedVoiceIds,
          trainees,
          includeNagsasanayMen,
          includeNagsasanayWomen,
          lastNameFirst,
          choir,
        ),
      },
    ]
  }

  const activeMembers = members.filter((member) => member.isActive)
  return (['female', 'male'] as const)
    .map((gender) => {
      const counter: AttendanceCounter = { value: 0 }
      const rows: MasterListAttendanceRow[] = []
      const genderMembers = activeMembers.filter(
        (member) => member.gender === gender,
      )

      if (selectedVoiceIds !== null) {
        for (const voice of voices) {
          if (!selectedVoiceIds.includes(voice.id)) continue
          const assigned = genderMembers.filter(
            (member) => member.voicePosition === voice.id,
          )
          if (assigned.length === 0) continue
          rows.push(
            { kind: 'section', label: voice.name },
            ...memberRows(assigned, voices, lastNameFirst, counter),
          )
        }
      } else if (genderMembers.length > 0) {
        rows.push(...memberRows(genderMembers, voices, lastNameFirst, counter))
      }

      // The sheet label already names the choir, so its Nagsasanay group is
      // the only section that needs a heading.
      rows.push(
        ...traineeSection(
          trainees,
          gender,
          gender === 'male' ? includeNagsasanayMen : includeNagsasanayWomen,
          lastNameFirst,
          counter,
        ),
      )
      return {
        label: gender === 'female' ? 'Babae' : 'Lalaki',
        rows,
      }
    })
    .filter((sheet) => sheet.rows.length > 0)
}

const ATTENDANCE_NAME_FONT_SIZES = {
  small: 8,
  normal: 9,
  large: 11,
} as const

/**
 * The printed member-name size. Attendance keeps its own Normal (9 pt) rather
 * than the Suguan preset's 11 pt, so the default sheet is unchanged; custom
 * sizes are clamped by the same helper the Suguan layout uses.
 */
export function attendanceNameFontSize(format: SuguanDocFormat): number {
  return format.fontSize === 'custom'
    ? clampCustomBodyFontSize(format.customBodyFontSize)
    : ATTENDANCE_NAME_FONT_SIZES[format.fontSize]
}

export const MIN_ATTENDANCE_ROW_SCALE = 0.8

/**
 * Fit-page row compaction: draw the whole roster on one page by tightening row
 * heights only. Font sizes never change. A roster that would need more than the
 * floor allows still paginates at full height, and a forced page break (the
 * separate-sheet mode's roster break) disables compaction.
 */
export function fitAttendanceRowHeights(
  rows: readonly MasterListAttendanceRow[],
  availableHeight: number,
  memberRowHeight: number,
  sectionRowHeight: number,
  scaling: DocScaling,
): { memberRowHeight: number; sectionRowHeight: number; scale: number } {
  const unscaled = { memberRowHeight, sectionRowHeight, scale: 1 }
  if (scaling !== 'fit-page' || availableHeight <= 0) return unscaled
  if (rows.some((row) => row.kind === 'page-break')) return unscaled
  const totalHeight = rows.reduce(
    (height, row) =>
      height +
      (row.kind === 'section'
        ? sectionRowHeight
        : row.kind === 'page-break'
          ? 0
          : memberRowHeight),
    0,
  )
  if (totalHeight <= availableHeight) return unscaled
  const factor = availableHeight / totalHeight
  if (factor < MIN_ATTENDANCE_ROW_SCALE) return unscaled
  return {
    memberRowHeight: memberRowHeight * factor,
    sectionRowHeight: sectionRowHeight * factor,
    scale: factor,
  }
}
