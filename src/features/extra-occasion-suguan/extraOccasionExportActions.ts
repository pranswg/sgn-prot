import type { Member } from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'
import {
  exportExtraOccasionDocx,
  exportExtraOccasionExcel,
  exportExtraOccasionPdf,
} from './extraOccasionSharedExport'
import type { ExtraOccasionExportOptions } from './extraOccasionExport'
import {
  buildOccasionPreview,
  type ExtraOccasionOccasionState,
} from './extraOccasionDraft'

export type ExtraOccasionExportKind = 'pdf' | 'xlsx' | 'docx'

/** Builds the exporter options for one occasion. Shared by maker and planner. */
export function occasionExportOptions(
  state: ExtraOccasionOccasionState,
  members: Member[],
  voices: VoicePosition[],
  filename: string,
): ExtraOccasionExportOptions {
  return {
    suguan: buildOccasionPreview(state),
    members,
    voices,
    organistaAssignments: state.organistaAssignments,
    pagsasanay: state.pagsasanay,
    pagtupad: state.pagtupad,
    showFooterSignatories: state.showFooterSignatories,
    localeName: state.churchName,
    docFormat: state.draft.docFormat,
    filename,
  }
}

export async function runOccasionExport(
  kind: ExtraOccasionExportKind,
  state: ExtraOccasionOccasionState,
  members: Member[],
  voices: VoicePosition[],
  filename: string,
): Promise<void> {
  const options = occasionExportOptions(state, members, voices, filename)
  if (kind === 'pdf') await exportExtraOccasionPdf(options)
  else if (kind === 'xlsx') await exportExtraOccasionExcel(options)
  else await exportExtraOccasionDocx(options)
}
