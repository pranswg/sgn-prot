export const MASTER_LIST_PAPER_SIZES = [
  { id: 'a4', label: 'A4', width: 210, height: 297 },
  { id: 'letter', label: 'Letter', width: 215.9, height: 279.4 },
  { id: 'legal', label: 'Legal', width: 215.9, height: 355.6 },
  { id: 'folio', label: 'Folio', width: 215.9, height: 330.2 },
] as const

export type MasterListPaperSize =
  (typeof MASTER_LIST_PAPER_SIZES)[number]['id']

export function isMasterListPaperSize(
  value: string,
): value is MasterListPaperSize {
  return MASTER_LIST_PAPER_SIZES.some((paper) => paper.id === value)
}
