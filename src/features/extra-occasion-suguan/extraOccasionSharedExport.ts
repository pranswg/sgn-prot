import type { ExtraOccasionSuguanConfig, Suguan } from '@/core/types/suguan'
import { exportSuguanExcel } from '@/lib/suguanExport'
import { exportSuguanDocx } from '@/features/suguan-builder/suguanDocxExport'
import { exportSuguanPdf } from '@/features/suguan-builder/suguanPdfExport'
import { exportFileName } from '@/lib/exportNaming'
import { useSettingsStore } from '@/store/settingsStore'
import { buildExtraOccasionSheetSuguan } from './extraOccasionData'
import type { ExtraOccasionExportOptions } from './extraOccasionExport'

function sharedSheetSuguan(options: ExtraOccasionExportOptions): Suguan {
  const config: ExtraOccasionSuguanConfig = {
    ...options.suguan.extraOccasion,
    localeName: options.localeName,
    pagsasanay: options.pagsasanay,
    pagtupad: options.pagtupad,
    showFooterSignatories: options.showFooterSignatories,
    organistaAssignments: options.organistaAssignments,
  }
  return buildExtraOccasionSheetSuguan(
    options.suguan,
    options.voices,
    options.members,
    config,
    useSettingsStore.getState().allDutyRoles(),
  )
}

export async function exportExtraOccasionExcel(
  options: ExtraOccasionExportOptions,
): Promise<void> {
  await exportSuguanExcel(
    sharedSheetSuguan(options),
    options.members,
    options.docFormat,
    options.filename ?? exportFileName('Extra Occasion Suguan', 'xlsx'),
  )
}

export async function exportExtraOccasionDocx(
  options: ExtraOccasionExportOptions,
): Promise<void> {
  await exportSuguanDocx(
    sharedSheetSuguan(options),
    options.members,
    options.docFormat,
    options.filename ?? exportFileName('Extra Occasion Suguan', 'docx'),
  )
}

export async function exportExtraOccasionPdf(
  options: ExtraOccasionExportOptions,
): Promise<void> {
  await exportSuguanPdf(
    sharedSheetSuguan(options),
    options.members,
    options.docFormat,
    undefined,
    'download',
    options.filename ?? exportFileName('Extra Occasion Suguan', 'pdf'),
  )
}

export async function createExtraOccasionPdfPreview(
  options: ExtraOccasionExportOptions,
): Promise<Blob> {
  const blob = await exportSuguanPdf(
    sharedSheetSuguan(options),
    options.members,
    options.docFormat,
    undefined,
    'preview',
  )
  if (!(blob instanceof Blob)) {
    throw new Error('PDF preview did not produce a document.')
  }
  return blob
}
