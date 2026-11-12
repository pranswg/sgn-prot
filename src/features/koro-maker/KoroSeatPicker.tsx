import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Music2, Plus, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { koroVoiceColor } from '@/lib/koro'
import type { KoroRosterEntry } from '@/lib/koro'
import { koroIsLabeled, koroIsSeated } from '@/lib/koroLayout'
import type { KoroCell } from '@/core/types/koro'
import type { VoicePosition } from '@/core/types/suguan'

interface KoroSeatPickerProps {
  cell: KoroCell
  /** Seat position, e.g. "Row 3 seat 4". Used for labels and the sheet title. */
  seatLabel: string
  /** Seat number within its row, printed in the tile corner. */
  seatNumber?: number
  members: KoroRosterEntry[]
  /**
   * Every seat each member holds, e.g. `["Table 1 · Row 2 seat 3", …]`. Used to
   * name the tables a duplicated seat belongs to and to mark members already
   * seated in the picker list.
   */
  seatLocations: Map<string, string[]>
  /** Member ids seated more than once anywhere in the document. */
  duplicatedIds: Set<string>
  voices: VoicePosition[]
  onSelect: (member: KoroRosterEntry | null) => void
  /**
   * Mark this seat with a reserved label such as "Organ", or clear it with
   * `null`. A labelled seat is not a member seat and prints its label instead.
   */
  onSetLabel: (label: string | null) => void
  /**
   * When set the seat no longer opens the picker; it reports the tap instead.
   * The table card uses this for swap mode, where a seat tap picks an endpoint.
   */
  onActivate?: () => void
}

/**
 * One seat's member picker. A searchable popover on desktop and a searchable
 * bottom sheet on phones, so seating a singer is a two-tap job instead of
 * scrolling a native select of the whole roster. Picking a member never warns
 * here: the page owns the "already seated, are you sure?" confirmation so the
 * pick, drag-and-drop, and any future path prompt the same way. A seat whose
 * occupant is duplicated across the chart carries an amber name and a
 * warning badge.
 */
export function KoroSeatPicker({
  cell,
  seatLabel,
  seatNumber,
  members,
  seatLocations,
  duplicatedIds,
  voices,
  onSelect,
  onSetLabel,
  onActivate,
}: KoroSeatPickerProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const seated = koroIsSeated(cell)
  const labeled = koroIsLabeled(cell)
  const label = (cell.label ?? '').trim()
  const current = cell.memberId
    ? members.find((member) => member.id === cell.memberId)
    : undefined
  const voiceLabel = (voicePosition: string) =>
    voices.find((voice) => voice.id === voicePosition)?.shortName ??
    voices.find((voice) => voice.id === voicePosition)?.name ??
    ''
  const voice = cell.voicePosition || current?.voicePosition || ''
  const fullName = current
    ? `${current.lastName.trim()}, ${current.firstName.trim()}`.replace(/^, /, '')
    : cell.firstName.trim()
  const displayName = labeled ? label : fullName
  const duplicated = cell.memberId ? duplicatedIds.has(cell.memberId) : false
  // Every seat this occupant holds, for the exclamation tooltip.
  const occupantLocations = cell.memberId
    ? seatLocations.get(cell.memberId) ?? []
    : []

  const openSeat = () => {
    if (onActivate) {
      onActivate()
      return
    }
    setOpen(true)
  }

  const trigger = (
    <button
      type="button"
      aria-label={`${seatLabel}: ${displayName || 'empty'}${
        duplicated ? ' (seated in more than one table)' : ''
      }`}
      aria-haspopup={onActivate ? undefined : 'dialog'}
      aria-expanded={onActivate ? undefined : open}
      title={
        duplicated
          ? `${seatLabel} · ${fullName} — also seated in ${occupantLocations.join(', ')}`
          : displayName
            ? `${seatLabel} · ${displayName}`
            : `${seatLabel} · choose member`
      }
      onClick={openSeat}
      className={cn(
        'relative flex h-16 w-full flex-col items-center justify-center gap-0.5 rounded-md border px-1 text-center transition-colors',
        seated
          ? 'border-black/20 text-black'
          : labeled
            ? 'border-orange-400 bg-orange-200 text-orange-950'
            : 'border-dashed border-foreground/25 bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground',
      )}
      style={seated ? { backgroundColor: koroVoiceColor(voice, voices) } : undefined}
    >
      {seatNumber !== undefined && (
        <span
          aria-hidden
          className={cn(
            'absolute top-0.5 left-1 text-[0.6rem] leading-none font-semibold tabular-nums',
            seated ? 'text-black/50' : labeled ? 'text-orange-900/60' : 'text-muted-foreground',
          )}
        >
          {seatNumber}
        </span>
      )}
      {duplicated && (
        <span
          aria-hidden
          className="absolute top-0.5 right-0.5 grid size-4 place-items-center rounded-full bg-amber-400 text-amber-950 shadow-sm"
        >
          <AlertTriangle className="size-3" />
        </span>
      )}
      {labeled ? (
        <span className="w-full truncate text-[0.72rem] leading-tight font-semibold">
          {label}
        </span>
      ) : seated ? (
        <>
          <span
            className={cn(
              'w-full truncate text-[0.72rem] leading-tight',
              duplicated
                ? 'rounded-sm bg-amber-300/90 px-1 font-semibold text-amber-950'
                : 'font-medium',
            )}
          >
            {cell.firstName.trim()}
          </span>
          <span className="text-[0.62rem] leading-tight text-black/60">
            {voiceLabel(voice)}
          </span>
        </>
      ) : (
        <Plus className="size-3.5" />
      )}
    </button>
  )

  if (onActivate) return trigger

  const list = (
    <SeatOptions
      members={members}
      seatLocations={seatLocations}
      currentId={cell.memberId}
      voices={voices}
      voiceLabel={voiceLabel}
      onPick={(member) => {
        onSelect(member)
        setOpen(false)
      }}
    />
  )

  if (isMobile) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[85dvh] gap-0 rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]"
          >
            <SheetHeader className="border-b border-border/70 pr-14">
              <SheetTitle>{seatLabel}</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {labeled ? (
                <Button
                  variant="outline"
                  className="min-h-11 w-full justify-start text-destructive"
                  onClick={() => {
                    onSetLabel(null)
                    setOpen(false)
                  }}
                >
                  <X className="size-4" />
                  Remove {label}
                </Button>
              ) : (
                <>
                  {cell.memberId && (
                    <Button
                      variant="outline"
                      className="mb-3 min-h-11 w-full justify-start text-destructive"
                      onClick={() => {
                        onSelect(null)
                        setOpen(false)
                      }}
                    >
                      <X className="size-4" />
                      Clear this seat
                    </Button>
                  )}
                  {!seated && (
                    <Button
                      variant="outline"
                      className="mb-3 min-h-11 w-full justify-start"
                      onClick={() => {
                        onSetLabel('Organ')
                        setOpen(false)
                      }}
                    >
                      <Music2 className="size-4" />
                      Mark as Organ
                    </Button>
                  )}
                  {list}
                </>
              )}
            </div>
            <div className="border-t border-border/70 px-4 pt-3">
              <Button
                variant="outline"
                className="min-h-11 w-full"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-0 p-2">
        {labeled ? (
          <button
            type="button"
            onClick={() => {
              onSetLabel(null)
              setOpen(false)
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-destructive select-none hover:bg-accent hover:text-accent-foreground"
          >
            <X className="size-4 shrink-0" />
            Remove {label}
          </button>
        ) : (
          <>
            {cell.memberId && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(null)
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-destructive select-none hover:bg-accent hover:text-accent-foreground"
                >
                  <X className="size-4 shrink-0" />
                  Clear this seat
                </button>
                <div className="pointer-events-none mx-2 my-1 h-px bg-border" />
              </>
            )}
            {!seated && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onSetLabel('ORGAN')
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm select-none hover:bg-accent hover:text-accent-foreground"
                >
                  <Music2 className="size-4 shrink-0" />
                  Mark as Organ
                </button>
                <div className="pointer-events-none mx-2 my-1 h-px bg-border" />
              </>
            )}
            {list}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

/**
 * The single searchable list shared by both presentations: name, voice, a tick
 * for the seat's current occupant, and a note when that member already sits
 * somewhere else. Choosing a member always calls `onPick`; the page decides
 * whether the seat is a duplicate and, if so, confirms before placing.
 */
function SeatOptions({
  members,
  seatLocations,
  currentId,
  voices,
  voiceLabel,
  onPick,
}: {
  members: KoroRosterEntry[]
  seatLocations: Map<string, string[]>
  currentId: string | null
  voices: VoicePosition[]
  voiceLabel: (voicePosition: string) => string
  onPick: (member: KoroRosterEntry | null) => void
}) {
  const [query, setQuery] = useState('')

  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    return members
      .filter((member) => {
        if (!q) return true
        const name = `${member.firstName} ${member.lastName} ${member.lastName}, ${member.firstName}`
        return name.toLowerCase().includes(q)
      })
      .sort(
        (left, right) =>
          left.lastName.localeCompare(right.lastName) ||
          left.firstName.localeCompare(right.firstName),
      )
  }, [members, query])

  const pick = (member: KoroRosterEntry) => {
    onPick(member)
  }

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search members"
          aria-label="Search members"
          className="pl-8"
        />
      </div>
      <div className="max-h-64 overflow-y-auto overscroll-contain">
        {options.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            {query.trim()
              ? `No unseated member matches “${query.trim()}”.`
              : 'Every active member is already seated.'}
          </p>
        ) : (
          options.map((member) => {
            const selected = member.id === currentId
            const voice = member.voicePosition
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => pick(member)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm select-none hover:bg-accent hover:text-accent-foreground',
                  selected && 'bg-accent text-accent-foreground',
                )}
              >
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-sm border border-black/20"
                  style={{ backgroundColor: koroVoiceColor(voice, voices) }}
                />
                <span className="min-w-0 flex-1 truncate">
                  {member.lastName.trim()}, {member.firstName.trim()}
                </span>
                {seatLocations.has(member.id) && member.id !== currentId && (
                  <span className="shrink-0 rounded-sm bg-amber-100 px-1 text-[0.62rem] text-amber-900 dark:bg-amber-400/20 dark:text-amber-100">
                    seated
                  </span>
                )}
                <span className="shrink-0 text-xs text-muted-foreground">
                  {voiceLabel(voice)}
                </span>
                {selected && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
