import { useMemo, useState } from 'react'
import { Search, Square, CheckSquare } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { Member } from '@/core/types/member'
import { getVoiceName } from '@/core/constants/voicePositions'
import { useSettingsStore } from '@/store/settingsStore'

interface MemberSelectorProps {
  candidates: Member[]
  excludedIds: string[]
  conflictIds: Set<string>
  onSelect: (members: Member[]) => void
  onClose: () => void
  emptyMessage?: string
  addLabel?: string
  singleSelect?: boolean
}

export function MemberSelector({
  candidates,
  excludedIds,
  conflictIds,
  onSelect,
  onClose,
  emptyMessage = 'No eligible members.',
  addLabel = 'Add Selected',
  singleSelect = false,
}: MemberSelectorProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const allVoices = useSettingsStore((s) => s.allVoices)
  const voices = allVoices()

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return candidates
      .filter((m) => {
        if (excludedIds.includes(m.id)) return false
        if (
          q &&
          !`${m.firstName} ${m.lastName}`.toLowerCase().includes(q) &&
          !getVoiceName(m.voicePosition, voices).toLowerCase().includes(q)
        )
          return false
        return true
      })
      .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))
  }, [candidates, excludedIds, query, voices])

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s)
      if (singleSelect) {
        next.clear()
        if (!s.has(id)) next.add(id)
        return next
      }
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedMembers = candidates.filter((m) => selected.has(m.id))

  const handleAdd = () => {
    if (selectedMembers.length === 0) return
    onSelect(selectedMembers)
    setSelected(new Set())
  }

  return (
    <div className="flex max-h-[420px] min-h-0 flex-col gap-2">
      <div className="relative shrink-0">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members..."
          className="pl-9"
        />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1">
          {list.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          )}
          {list.map((m) => {
            const inConflict = conflictIds.has(m.id)
            const isSelected = selected.has(m.id)
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                  isSelected && 'bg-accent',
                  inConflict && 'opacity-60 hover:opacity-100',
                )}
              >
                <span className="min-w-0">
                  <span className={cn('font-medium', isSelected && 'text-primary')}>
                    {m.firstName} {m.lastName}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {getVoiceName(m.voicePosition, voices)}
                  </span>
                </span>
                {inConflict ? (
                  <span className="shrink-0 text-xs font-medium text-amber-600 dark:text-amber-400">
                    conflict
                  </span>
                ) : isSelected ? (
                  <CheckSquare className="size-4 shrink-0 text-primary" />
                ) : (
                  <Square className="size-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            )
          })}
        </div>
      </ScrollArea>
      <div className="flex shrink-0 items-center justify-between gap-2 border-t pt-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleAdd} disabled={selected.size === 0}>
          {addLabel} ({selected.size})
        </Button>
      </div>
    </div>
  )
}