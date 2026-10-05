/**
 * The mobile directory's filter chips. Kept out of `MobileFilterSheet` so the
 * sheet can stay a pure component and the chip row, the sheet title, and each
 * section heading all read the same labels instead of repeating them.
 */
export type MobileFilterSection = 'voices' | 'status' | 'roles'

/** Chip labels, sheet titles, and section headings all read from here. */
export const MOBILE_FILTER_LABEL: Record<MobileFilterSection, string> = {
  voices: 'Voice',
  status: 'Status',
  roles: 'Roles',
}

/**
 * The chip order, which is also the order the sheet stacks sections in when it
 * is opened without a particular chip. Both read this so the two can never
 * disagree about which filter comes first. Gender is deliberately absent: the
 * All/Women/Men choir segment owns that filter now. Membership is absent for
 * the same reason: the Regular option lives inside the Roles section.
 */
export const MOBILE_FILTER_SECTIONS: MobileFilterSection[] = [
  'voices',
  'status',
  'roles',
]
