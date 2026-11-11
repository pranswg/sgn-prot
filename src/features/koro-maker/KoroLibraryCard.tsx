import { useMemo, useState } from 'react'
import { Copy, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { koroDocumentCounts } from '@/lib/koroLayout'
import type { KoroDocument } from '@/core/types/koro'

interface KoroLibraryCardProps {
  documents: KoroDocument[]
  activeId: string
  onSelect: (id: string) => void
  onDuplicate: (id: string) => void
}

/**
 * The saved-Koro library: search, pick, and duplicate. A formation repeats from
 * week to week, so duplicating one is the fastest way to start the next service;
 * renaming is the same Occasion title field below.
 */
export function KoroLibraryCard({
  documents,
  activeId,
  onSelect,
  onDuplicate,
}: KoroLibraryCardProps) {
  const [query, setQuery] = useState('')
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return documents
      .filter((document) => {
        if (!q) return true
        return `${document.title} ${document.date}`.toLowerCase().includes(q)
      })
      .slice()
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }, [documents, query])

  return (
    <section className="grid gap-3 rounded-xl border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Saved Koro
          </p>
          <p className="text-sm text-muted-foreground">
            {documents.length} saved · newest edit first
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search saved Koro"
            aria-label="Search saved Koro"
            className="pl-8"
          />
        </div>
      </div>

      <div className="max-h-56 overflow-y-auto overscroll-contain">
        {rows.length === 0 ? (
          <p className="px-1 py-3 text-sm text-muted-foreground">
            No Koro matches “{query.trim()}”.
          </p>
        ) : (
          <ul className="grid gap-1">
            {rows.map((document) => {
              const active = document.id === activeId
              const counts = koroDocumentCounts(document)
              return (
                <li
                  key={document.id}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-2 py-2',
                    active
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-transparent hover:bg-muted/50',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(document.id)}
                    aria-pressed={active}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-medium">
                      {document.title.trim() || 'Untitled Koro'}
                    </span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {document.date || 'No date'} · {counts.filled}/
                      {counts.seats} seats
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Duplicate ${document.title.trim() || 'Untitled Koro'}`}
                    title="Duplicate"
                    onClick={() => onDuplicate(document.id)}
                  >
                    <Copy className="size-4" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
