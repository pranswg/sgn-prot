import type { Member } from '@/core/types/member'
import type {
  ExtraOccasionDateColumn,
  ExtraOccasionOrganistaAssignment,
  ExtraOccasionSuguanConfig,
  Suguan,
  SuguanDocFormat,
  VoicePosition,
} from '@/core/types/suguan'
import { normalizeDocFormat } from '@/lib/suguanUtils'

export interface ExtraOccasionExportOptions {
  suguan: Suguan
  members: Member[]
  voices: VoicePosition[]
  organistaAssignments: Record<string, ExtraOccasionOrganistaAssignment[]>
  pagsasanay: ExtraOccasionDateColumn
  pagtupad: ExtraOccasionDateColumn
  showFooterSignatories: boolean
  localeName: string
  docFormat: SuguanDocFormat
  filename?: string
}

export function extraOccasionExportOptionsForRecord(
  suguan: Suguan,
  members: Member[],
  voices: VoicePosition[],
): ExtraOccasionExportOptions {
  const config: ExtraOccasionSuguanConfig | undefined = suguan.extraOccasion
  if (!config) {
    throw new Error('This Suguan record does not have Extra Occasion settings.')
  }
  return {
    suguan,
    members,
    voices,
    organistaAssignments: config.organistaAssignments,
    pagsasanay: config.pagsasanay,
    pagtupad: config.pagtupad,
    showFooterSignatories: config.showFooterSignatories,
    localeName: config.localeName,
    docFormat: normalizeDocFormat(suguan.docFormat),
  }
}
