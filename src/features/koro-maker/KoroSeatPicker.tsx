import { useMemo, useState } from 'react'
import { Check, Plus, Search, X } from 'lucide-react'
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
import { koroIsSeated } from '@/lib/koroLayout'
import type { KoroCell } from '@/core/types/koro'
import type { Member } from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'

interface KoroSeatPickerProps {
  cell: KoroCell
  /** Seat position, e.g. "Row 3 seat 4". Used for labels and the sheet title. */
  seatLabel: string
  members: Member[]
  /** Where each already-seated member sits, e.g. "Table 2 · Row 1 seat 3". */
  placedSeats: Map<string, string>
  voices: VoicePosition[]
  onSelect: (member: Member | null) => void
  /**
   * When set the seat no longer opens the picker; it reports the tap instead.
   * The table card uses this for swap mode, where a seat tap picks an endpoint.
   */
  onActivate?: () => void
}

/**
 * One seat's member picker. A searchable popover on desktop and a searchable
 * bottom sheet on phones, so seating a singer is a two-tap job instead of
 * scrolling a native select of the whole roster. Members already seated
 * elsewhere are hidden; the current occupant stays listed so the seat can be
 * cleared from the same window.
 */
export function KoroSeatPicker({
  cell,
  seatLabel,
  members,
  placedSeats,
  voices,
  onSelect,
  onActivate,
}: KoroSeatPickerProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const seated = koroIsSeated(cell)
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
      aria-label={`${seatLabel}: ${fullName || 'empty'}`}
      aria-haspopup={onActivate ? undefined : 'dialog'}
      aria-expanded={onActivate ? undefined : open}
      title={fullName ? `${seatLabel} · ${fullName}` : `${seatLabel} · choose member`}
      onClick={openSeat}
      className={cn(
        'flex h-16 w-full flex-col items-center justify-center gap-0.5 rounded-md border px-1 text-center transition-colors',
        seated
          ? 'border-black/20 text-black'
          : 'border-dashed border-foreground/25 bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground',
      )}
      style={seated ? { backgroundColor: koroVoiceColor(voice, voices) } : undefined}
    >
      {seated ? (
        <>
          <span className="w-full truncate text-[0.72rem] leading-tight font-medium">
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
      placedSeats={placedSeats}
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
              {list}
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
        {list}
      </PopoverContent>
    </Popover>
  )
}

/**
 * The single searchable list shared by both presentations: name, voice, a tick
 * for the seat's current occupant, and a note when that member already sits
 * somewhere else. Picking an already-seated member asks first instead of
 * hiding them, so the same singer can still be placed twice on purpose.
 */
function SeatOptions({
  members,
  placedSeats,
  currentId,
  voices,
  voiceLabel,
  onPick,
}: {
  members: Member[]
  placedSeats: Map<string, string>
  currentId: string | null
  voices: VoicePosition[]
  voiceLabel: (voicePosition: string) => string
  onPick: (member: Member | null) => void
}) {
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<Member | null>(null)

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

  const pick = (member: Member) => {
    const elsewhere = placedSeats.get(member.id)
    if (elsewhere && member.id !== currentId) {
      setPending(member)
      return
    }
    onPick(member)
  }

  if (pending) {
    const elsewhere = placedSeats.get(pending.id) ?? 'another table'
    return (
      <div className="grid gap-2 rounded-lg border border-amber-300/70 bg-amber-50/70 p-3 text-xs text-amber-950 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100">
        <p>
          <span className="font-semibold">
            {pending.firstName} {pending.lastName}
          </span>{' '}
          is already seated in {elsewhere}. Add them to this seat as well?
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPending(null)}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={() => onPick(pending)}>
            Add anyway
          </Button>
        </div>
      </div>
    )
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
                {placedSeats.has(member.id) && member.id !== currentId && (
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
