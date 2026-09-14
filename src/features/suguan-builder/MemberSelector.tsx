import { useMemo, useState } from 'react'
import { Search, Check } from 'lucide-react'
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
  onSelect: (member: Member) => void
  onClose: () => void
  emptyMessage?: string
}

export function MemberSelector({
  candidates,
  excludedIds,
  conflictIds,
  onSelect,
  onClose,
  emptyMessage = 'No eligible members.',
}: MemberSelectorProps) {
  const [query, setQuery] = useState('')
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

  return (
    <div className="flex max-h-[420px] flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members..."
          className="pl-9"
        />
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1">
          {list.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          )}
          {list.map((m) => {
            const inConflict = conflictIds.has(m.id)
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m)}
                className={cn(
                  'flex items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                  inConflict && 'opacity-60 hover:opacity-100',
                )}
              >
                <span>
                  <span className="font-medium">
                    {m.firstName} {m.lastName}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {getVoiceName(m.voicePosition, voices)}
                  </span>
                </span>
                {inConflict ? (
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    conflict
                  </span>
                ) : (
                  <Check className="size-4 text-muted-foreground" />
                )}
              </button>
            )
          })}
        </div>
      </ScrollArea>
      <Button variant="ghost" size="sm" onClick={onClose} className="self-end">
        Close
      </Button>
    </div>
  )
}