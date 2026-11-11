import type { ReactNode } from 'react'

/**
 * The Extra Occasion page title block: the document title, a second line that
 * names the occasion and its choir, and a soft badge on the right. The app
 * shell already carries the mobile navigation bar, so this is a plain title
 * rather than a second sticky header.
 */
export function ExtraOccasionHeader({
  title,
  subtitle,
  badge,
}: {
  title: string
  subtitle?: ReactNode
  badge?: ReactNode
}) {
  return (
    <header className="occasion-page-header">
      <div className="min-w-0">
        <h1>{title}</h1>
        {subtitle != null && <p>{subtitle}</p>}
      </div>
      {badge != null && (
        <span className="hidden shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground sm:inline-flex">
          {badge}
        </span>
      )}
    </header>
  )
}
