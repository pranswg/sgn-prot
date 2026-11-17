/**
 * The shared green/red language for Active/Inactive status. Every badge,
 * timeline event, and history summary reads these strings, so an Inactive
 * surface cannot drift into grey or amber.
 */
export const ACTIVE_TONE =
  'bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-300'

export const INACTIVE_TONE =
  'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300'

export const ACTIVE_DOT_TONE = 'bg-green-600'

export const INACTIVE_DOT_TONE = 'bg-red-600'

export const INACTIVE_TEXT_TONE = 'text-red-600 dark:text-red-300'
