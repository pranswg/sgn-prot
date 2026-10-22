import type { Choir, Member, Trainee } from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'
import { sortMasterListPdfMembers } from '@/lib/masterListPdfData'
import { formatDateKeyLongDate, type DateKey } from '@/lib/phDate'

export type MasterListAttendanceRow =
  | { kind: 'section'; label: string }
  | { kind: 'member'; member: Member; name: string; number: number }
  | { kind: 'trainee'; name: string; number: number }

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

export function paginateMasterListAttendanceRows(
  rows: MasterListAttendanceRow[],
  regularPageHeight: number,
  finalPageHeight: number,
  memberRowHeight = 26,
  sectionRowHeight = 22,
): MasterListAttendanceRow[][] {
  const heightOf = (row: MasterListAttendanceRow) =>
    row.kind === 'section' ? sectionRowHeight : memberRowHeight
  const totalHeight = (items: MasterListAttendanceRow[]) =>
    items.reduce((height, row) => height + heightOf(row), 0)

  const pages: MasterListAttendanceRow[][] = []
  let offset = 0
  let currentSection: string | undefined

  while (offset < rows.length) {
    const continuation =
      currentSection && rows[offset].kind !== 'section'
        ? [{ kind: 'section' as const, label: currentSection }]
        : []
    const finalPageRows = [...continuation, ...rows.slice(offset)]
    if (totalHeight(finalPageRows) <= finalPageHeight) {
      pages.push(finalPageRows)
      break
    }

    const pageRows: MasterListAttendanceRow[] = [...continuation]
    let usedHeight = totalHeight(continuation)
    const pageStart = offset
    while (offset < rows.length) {
      const row = rows[offset]
      const rowHeight = heightOf(row)
      if (usedHeight + rowHeight > regularPageHeight) break
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
  let number = 0
  const formatName = (person: Member | Trainee): string => {
    const givenNames = [person.firstName, person.middleName]
      .filter(Boolean)
      .join(' ')
    const familyName = person.lastName
    const name = lastNameFirst
      ? [familyName, givenNames].filter(Boolean).join(', ')
      : [givenNames, familyName].filter(Boolean).join(' ')
    return [name, person.suffix].filter(Boolean).join(' ')
  }
  const memberRows = (items: Member[]): MasterListAttendanceRow[] =>
    sortMasterListPdfMembers(items, voices, 'name').map((member) => ({
      kind: 'member',
      member,
      name: formatName(member),
      number: ++number,
    }))

  const rows =
    choir === 'pnk'
      ? (['female', 'male'] as const).flatMap((gender) => {
          const genderMembers = activeMembers.filter(
            (member) => member.gender === gender,
          )
          const genderTrainees = trainees
            .filter(
              (trainee) =>
                trainee.status === 'active' &&
                trainee.gender === gender &&
                (gender === 'male'
                  ? includeNagsasanayMen
                  : includeNagsasanayWomen),
            )
            .sort(
              (left, right) =>
                left.lastName.localeCompare(right.lastName) ||
                left.firstName.localeCompare(right.firstName) ||
                left.id.localeCompare(right.id),
            )
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
                    name: formatName(person),
                    number: ++number,
                  }
                : {
                    kind,
                    name: formatName(person),
                    number: ++number,
                  },
            ),
          ]
        })
      : selectedVoiceIds === null
      ? [
          ...memberRows(
            activeMembers.filter((member) => member.gender === 'female'),
          ),
          ...memberRows(
            activeMembers.filter((member) => member.gender === 'male'),
          ),
        ]
      : voices
          .filter((voice) => selectedVoiceIds.includes(voice.id))
          .flatMap((voice) => {
            const assigned = activeMembers.filter(
              (member) => member.voicePosition === voice.id,
            )
            if (assigned.length === 0) return []
            return [
              { kind: 'section' as const, label: voice.name },
              ...memberRows(assigned),
            ]
          })

  const activeTrainees = trainees.filter(
    (trainee) => trainee.status === 'active',
  )
  const traineeSection = (
    label: string,
    gender: Trainee['gender'],
  ): MasterListAttendanceRow[] => {
    const selected = activeTrainees
      .filter((trainee) => trainee.gender === gender)
      .sort(
        (left, right) =>
          left.lastName.localeCompare(right.lastName) ||
          left.firstName.localeCompare(right.firstName) ||
          left.id.localeCompare(right.id),
      )
    if (selected.length === 0) return []
    return [
      { kind: 'section', label },
      ...selected.map((trainee) => ({
        kind: 'trainee' as const,
        name: formatName(trainee),
        number: ++number,
      })),
    ]
  }

  return [
    ...rows,
    ...(choir !== 'pnk' && includeNagsasanayMen
      ? traineeSection('Nagsasanay Men', 'male')
      : []),
    ...(choir !== 'pnk' && includeNagsasanayWomen
      ? traineeSection('Nagsasanay Women', 'female')
      : []),
  ]
}
