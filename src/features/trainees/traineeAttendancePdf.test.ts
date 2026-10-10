import assert from 'node:assert/strict'
import test from 'node:test'

import { sortTraineesForAttendanceSheet } from './attendanceSheetSort.ts'
import type { Trainee } from '@/core/types/member'

const buildTrainee = (
  id: string,
  gender: Trainee['gender'],
  dateAdded: string,
  firstName: string,
  lastName: string,
): Trainee => ({
  id,
  firstName,
  middleName: '',
  lastName,
  gender,
  voicePosition: 'soprano',
  status: 'active',
  dateAdded,
})

test('trainee attendance sheet keeps women first and orders each group chronologically', () => {
  const trainees = [
    buildTrainee('m-2', 'male', '2024-02-18', 'Marco', 'Lopez'),
    buildTrainee('f-2', 'female', '2024-02-10', 'Fiona', 'Dela Cruz'),
    buildTrainee('m-1', 'male', '2024-01-10', 'Manuel', 'Santos'),
    buildTrainee('f-1', 'female', '2024-01-02', 'Faith', 'Reyes'),
  ]

  assert.deepEqual(
    sortTraineesForAttendanceSheet(trainees).map((trainee) => trainee.id),
    ['f-1', 'f-2', 'm-1', 'm-2'],
  )
})
