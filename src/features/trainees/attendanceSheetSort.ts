import type { Trainee } from '@/core/types/member'

function traineeChronologicalValue(trainee: Trainee): number {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(trainee.dateAdded)
  if (match) {
    const parsed = Date.parse(`${match[1]}T00:00:00Z`)
    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed
  }

  const parsed = Date.parse(trainee.dateAdded)
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed
}

export function sortTraineesForAttendanceSheet(trainees: Trainee[]): Trainee[] {
  return [...trainees].sort((left, right) => {
    const leftGenderRank = left.gender === 'female' ? 0 : 1
    const rightGenderRank = right.gender === 'female' ? 0 : 1

    if (leftGenderRank !== rightGenderRank) {
      return leftGenderRank - rightGenderRank
    }

    const leftChrono = traineeChronologicalValue(left)
    const rightChrono = traineeChronologicalValue(right)
    if (leftChrono !== rightChrono) {
      return leftChrono - rightChrono
    }

    return `${left.lastName} ${left.firstName}`.localeCompare(
      `${right.lastName} ${right.firstName}`,
    )
  })
}
