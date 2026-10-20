export const MAX_ATTENDANCE_DATE_COLUMNS = 8

/** Splits only when the selected dates exceed the printable column limit. */
export function createAttendanceDatePanels<T>(
  dates: readonly T[],
  maxColumns = MAX_ATTENDANCE_DATE_COLUMNS,
): T[][] {
  if (!Number.isInteger(maxColumns) || maxColumns < 1) {
    throw new Error('Attendance date panel width must be a positive integer.')
  }

  const panels: T[][] = []
  for (let index = 0; index < dates.length; index += maxColumns) {
    panels.push(dates.slice(index, index + maxColumns))
  }
  return panels
}
