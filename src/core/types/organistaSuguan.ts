import type { SuguanDocFormat } from './suguan'

export interface OrganistaSuguanService {
  id: string
  /**
   * Id of the worship schedule this card was picked from, when it came from
   * the Worship Service Schedule Settings. Absent on legacy records that
   * predate the schedule picker.
   */
  scheduleId?: string
  /**
   * Day-name snapshot taken when the card was added, e.g. "Miyerkules".
   * Absent on legacy records, which only carry `heading`.
   */
  dayName?: string
  /** Time snapshot taken when the card was added, e.g. "7:00 PM". */
  scheduleTime?: string
  /** "Midweek Worship" or "Weekend Worship", snapshot of the Schedule category. */
  categoryLabel?: string
  /**
   * Printed heading, e.g. "Miyerkules 7:00 PM". Stored at creation so changing
   * a schedule in Settings never rewrites a saved record (historical records
   * keep the schedule info they were created with).
   */
  heading: string
  organist: string
  reserve: string
}

export interface OrganistaSuguanRecord {
  id: string
  churchName: string
  pagsasanayDate: string
  services: OrganistaSuguanService[]
  docFormat: SuguanDocFormat
  pangulongMangaawitName: string
  destinadoName: string
  createdAt: string
  updatedAt: string
}
