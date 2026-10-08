import { useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, PenLine, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { fullName } from '@/lib/format'
import { memberIsOrganist } from '@/core/constants/memberMembership'
import { useMemberStore } from '@/store/memberStore'
import { useSettingsStore } from '@/store/settingsStore'
import { memberSubtitle } from './organistaSuguanService'

interface MemberOption {
  id: string
  name: string
  subtitle: string
}

interface MemberPickerProps {
  id: string
  /** Field label, used for the sheet title ("Select {label}"). */
  label: string
  value: string
  onChange: (name: string) => void
  /** Names hidden so the same person cannot cover both halves of a service. */
  exclude: string[]
  /** Show the pinned N/A option. */
  allowNA?: boolean
  placeholder?: string
}

/**
 * The Organista / Reserba picker. Only Master List members holding an
 * organist-family privilege are offered, and every row shows the member's
 * voice position (when set) and privilege. It stays a hybrid box on desktop:
 * the field is free text with a dropdown that filters as you type, and the
 * pinned N/A stores the literal "N/A". On mobile the field is a tappable
 * control that opens a searchable bottom sheet with larger touch targets.
 */
export function MemberPicker({
  id,
  label,
  value,
  onChange,
  exclude,
  allowNA = false,
  placeholder,
}: MemberPickerProps) {
  const isMobile = useIsMobile()
  const members = useMemberStore((state) => state.members)
  const allVoices = useSettingsStore((state) => state.allVoices)
  const voices = allVoices()

  const options = useMemo<MemberOption[]>(() => {
    const taken = new Set(exclude.map((name) => name.trim().toLowerCase()))
    return members
      .filter((member) => member.isActive && memberIsOrganist(member))
      .filter((member) => {
        const name = fullName(member.firstName, member.lastName)
          .trim()
          .toLowerCase()
        return !taken.has(name)
      })
      .sort((a, b) => a.lastName.localeCompare(b.lastName))
      .map((member) => ({
        id: member.id,
        name: fullName(member.firstName, member.lastName),
        subtitle: memberSubtitle(member, voices),
      }))
  }, [members, exclude, voices])

  const currentKey = value.trim().toLowerCase()
  const isNA = currentKey === 'n/a'

  if (isMobile) {
    return (
      <MobileMemberSheet
        id={id}
        label={label}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        options={options}
        isNA={isNA}
        allowNA={allowNA}
      />
    )
  }

  return (
    <DesktopMemberCombobox
      id={id}
      label={label}
      value={value}
      placeholder={placeholder}
      onChange={onChange}
      options={options}
      currentKey={currentKey}
      isNA={isNA}
      allowNA={allowNA}
    />
  )
}

function DesktopMemberCombobox({
  id,
  label,
  value,
  placeholder,
  onChange,
  options,
  currentKey,
  isNA,
  allowNA,
}: {
  id: string
  label: string
  value: string
  placeholder?: string
  onChange: (name: string) => void
  options: MemberOption[]
  currentKey: string
  isNA: boolean
  allowNA: boolean
}) {
  const [open, setOpen] = useState(false)
  const [contentWidth, setContentWidth] = useState(0)
  const anchorRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const openCombobox = () => {
    setContentWidth(anchorRef.current?.offsetWidth ?? 0)
    setOpen(true)
  }

  const focusTyping = () => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }

  const selectName = (name: string) => {
    onChange(name)
    setOpen(false)
  }

  const query = isNA ? '' : currentKey
  const filtered = useMemo(
    () =>
      options.filter((option) => {
        if (!query) return true
        return `${option.name} ${option.subtitle}`.toLowerCase().includes(query)
      }),
    [options, query],
  )

  const itemClasses =
    'flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm select-none hover:bg-accent hover:text-accent-foreground'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} onClick={openCombobox} className="relative">
          <Input
            id={id}
            ref={inputRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={openCombobox}
            onBlur={() => setOpen(false)}
            placeholder={placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label={label}
            className="pr-9"
          />
          <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="end"
        side="bottom"
        avoidCollisions={false}
        className="max-h-72 min-w-36 gap-0 overflow-y-auto rounded-lg p-1"
        style={contentWidth > 0 ? { width: contentWidth } : undefined}
        onMouseDown={(event) => event.preventDefault()}
      >
        <button type="button" onClick={focusTyping} className={itemClasses}>
          <PenLine className="size-4 shrink-0 text-muted-foreground" />
          Type a name…
        </button>
        <div className="pointer-events-none mx-1 my-1 h-px bg-border" />
        {allowNA && (
          <button
            type="button"
            onClick={() => selectName('N/A')}
            className={cn(itemClasses, isNA && 'bg-accent text-accent-foreground')}
          >
            N/A
            {isNA && (
              <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
                <Check className="size-4" />
              </span>
            )}
          </button>
        )}
        {allowNA && <div className="pointer-events-none mx-1 my-1 h-px bg-border" />}
        {filtered.length === 0 ? (
          <div className="py-1 pr-8 pl-1.5 text-sm text-muted-foreground">
            {query ? `No match for "${value.trim()}"` : 'No eligible contributors in the Master List'}
          </div>
        ) : (
          filtered.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => selectName(option.name)}
              className={cn(
                'flex w-full cursor-default flex-col py-1.5 pr-8 pl-1.5 text-left select-none hover:bg-accent hover:text-accent-foreground',
                option.name.toLowerCase() === currentKey &&
                  'bg-accent text-accent-foreground',
              )}
            >
              <span className="truncate text-sm font-medium">{option.name}</span>
              {option.subtitle && (
                <span className="truncate text-xs text-muted-foreground">
                  {option.subtitle}
                </span>
              )}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  )
}

function MobileMemberSheet({
  id,
  label,
  value,
  placeholder,
  onChange,
  options,
  isNA,
  allowNA,
}: {
  id: string
  label: string
  value: string
  placeholder?: string
  onChange: (name: string) => void
  options: MemberOption[]
  isNA: boolean
  allowNA: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            value ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {value || placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <MobileMemberSheetBody
          label={label}
          value={value}
          onChange={onChange}
          options={options}
          isNA={isNA}
          allowNA={allowNA}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

/**
 * The mounted bottom sheet. Owns its own `draft` so typing only commits on a
 * selection, Done, or N/A — Cancel discards the edit — and it is persistently
 * rendered while open, so the draft survives re-renders of the parent.
 */
function MobileMemberSheetBody({
  label,
  value,
  onChange,
  options,
  isNA,
  allowNA,
  onClose,
}: {
  label: string
  value: string
  onChange: (name: string) => void
  options: MemberOption[]
  isNA: boolean
  allowNA: boolean
  onClose: () => void
}) {
  const [draft, setDraft] = useState(value)

  const commitAndClose = (next: string) => {
    onChange(next)
    onClose()
  }

  const q = draft.trim().toLowerCase()
  const list = options.filter((option) =>
    q ? `${option.name} ${option.subtitle}`.toLowerCase().includes(q) : true,
  )

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] gap-0 rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-border" />
        <SheetHeader className="border-b border-border/70 pr-14">
          <SheetTitle>Select {label}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="relative mb-3 shrink-0">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Search or type a name…"
              className="pl-9"
              aria-label={`Search ${label.toLowerCase()} members`}
            />
            {draft && (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-accent"
                onClick={() => setDraft('')}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1">
            {allowNA && (
              <button
                type="button"
                onClick={() => commitAndClose('N/A')}
                className="pressable flex min-h-12 items-center justify-between rounded-lg px-3 text-left text-sm font-medium hover:bg-accent motion-reduce:transform-none"
              >
                N/A
                {isNA && <Check className="size-4 text-primary" />}
              </button>
            )}
            {list.length === 0 ? (
              <button
                type="button"
                onClick={() => commitAndClose(q ? draft.trim() : '')}
                className="pressable min-h-12 rounded-lg px-3 py-3 text-left text-sm hover:bg-accent motion-reduce:transform-none"
              >
                <span className="font-medium">
                  Use “{q ? draft.trim() : '…'}”
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Not in the Master List — type it as-is
                </span>
              </button>
            ) : (
              list.map((option) => {
                const selected = option.name.toLowerCase() === q
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => commitAndClose(option.name)}
                    className="pressable min-h-14 rounded-lg px-3 py-3 text-left hover:bg-accent motion-reduce:transform-none"
                  >
                    <span className="block truncate text-sm font-medium">
                      {option.name}
                    </span>
                    {option.subtitle && (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {option.subtitle}
                      </span>
                    )}
                    {selected && (
                      <Check className="float-right -mt-4 size-4 text-primary" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
        <div className="border-t border-border/70 px-4 pt-3">
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="min-h-11 flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="min-h-11 flex-1"
              onClick={() => commitAndClose(q ? draft.trim() : '')}
            >
              Done
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}