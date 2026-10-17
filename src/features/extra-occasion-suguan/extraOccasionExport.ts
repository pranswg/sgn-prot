import type { Member } from '@/core/types/member'
import type {
  ExtraOccasionSuguanConfig,
  Suguan,
  SuguanDocFormat,
  VoicePosition,
} from '@/core/types/suguan'
import { normalizeDocFormat } from '@/lib/suguanUtils'
import type { ExtraOrganistaAssignment } from './extraOccasionData'

/**
 * Everything an Extra Occasion export is described by.
 *
 * There is deliberately no renderer here. An occasion prints through the same
 * preview and PDF/Excel/Word builders as the Choir Suguan sheet
 * (`SuguanSheetPage` plus `suguanPdfExport` / `exportSuguanExcel` /
 * `suguanDocxExport`), driven by `extraOccasionSharedExport` with the sheet
 * `buildExtraOccasionSheetSuguan` adapts. An occasion sheet therefore shares the
 * Choir Suguan fonts, table geometry and document setup exactly.
 *
 * Do not add a second set of occasion-only layout constants: the occasion once
 * had its own PDF, Excel and Word renderers and they drifted from the printed
 * sheet, which is the bug the shared path removed.
 */
export interface ExtraOccasionExportOptions {
  suguan: Suguan
  members: Member[]
  voices: VoicePosition[]
  organistaAssignments: Record<string, ExtraOrganistaAssignment[]>
  pagsasanay: { enabled: boolean; label: string; date: string }
  pagtupad: { enabled: boolean; label: string; date: string }
  showFooterSignatories: boolean
  localeName: string
  docFormat: SuguanDocFormat
  filename?: string
}

/**
 * The export options for a saved record, read back from its `extraOccasion`
 * block.
 */
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
