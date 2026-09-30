/**
 * Collapsible, searchable editor for one of the reference lists in Settings
 * (service types, duty roles, voice positions).
 *
 * Replaces the long "list of rows plus a separate add row" pattern with a single
 * dropdown, so a long list no longer pushes the rest of the page off screen.
 * The dropdown is searchable, the open/close is animated, and rows can still be
 * renamed or removed. New entries can be typed straight into the search box and
 * created with "Create ...".
 */

import { useMemo, useState } from 'react'
import { Check, ChevronDown, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'

/** One editable field on a list item. */
export interface ListEditorField {
  /** Store key, e.g. 'name' or 'abbreviation'. */
  key: string
  label: string
  /** Ignored when `options` is set. */
  placeholder?: string
  /** When present the field renders as a choice instead of a text input. */
  options?: { value: string; label: string }[]
  /** Optional width hint, e.g. 'w-24' or 'w-28'. */
  className?: string
}

export interface ListEditorItem {
  id: string
  /** True for entries seeded from constants, which the UI labels "standard". */
  custom?: boolean
}

export interface ListEditorProps<T extends ListEditorItem> {
  items: T[]
  fields: ListEditorField[]
  /** Primary label for a row, e.g. the name. */
  getLabel: (item: T) => string
  /** Secondary label shown after the name, e.g. an abbreviation or gender. */
  getMeta?: (item: T) => string | undefined
  noun: string
  onCreate: (values: Record<string, string>) => void
  onUpdate: (id: string, values: Record<string, string>) => void
  onDelete: (id: string) => void
  className?: string
}

export function ListEditor<T extends ListEditorItem>({
  items,
  fields,
  getLabel,
  getMeta,
  noun,
  onCreate,
  onUpdate,
  onDelete,
  className,
}: ListEditorProps<T>) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [createValues, setCreateValues] = useState<Record<string, string>>({})

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const haystack = `${getLabel(item)} ${getMeta?.(item) ?? ''}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [items, search, getLabel, getMeta])

  // Offer "Create ..." only when the typed text is not already a list entry.
  const trimmedSearch = search.trim()
  const showCreate =
    trimmedSearch.length > 0 &&
    !items.some((i) => getLabel(i).toLowerCase() === trimmedSearch.toLowerCase())

  const startEdit = (item: T) => {
    const values: Record<string, string> = {}
    for (const field of fields) {
      const raw = (item as unknown as Record<string, unknown>)[field.key]
      values[field.key] = typeof raw === 'string' ? raw : ''
    }
    setEditValues(values)
    setEditingId(item.id)
    setSearch('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValues({})
  }

  const saveEdit = () => {
    if (!editingId) return
    const first = fields[0]?.key
    if (!first || !editValues[first]?.trim()) return
    onUpdate(editingId, editValues)
    cancelEdit()
    toast.success(`${cap(noun)} updated.`)
  }

  const submitCreate = () => {
    const first = fields[0]?.key
    if (!first || !createValues[first]?.trim()) return
    onCreate(createValues)
    setCreateValues({})
    setSearch('')
    toast.success(`${cap(noun)} added.`)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setSearch('')
          cancelEdit()
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between px-3 font-normal',
            className,
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {items.length === 0
              ? `No ${noun} yet`
              : `${items.length} ${items.length === 1 ? noun : plural(noun)}`}
          </span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 opacity-60 transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-(--radix-popover-trigger-width) gap-0 p-0"
      >
        <Command
          shouldFilter={false}
          className="rounded-lg!"
          onKeyDown={(e) => {
            // Enter in the search box creates, matching the "Create ..." row.
            if (e.key === 'Enter' && showCreate) {
              e.preventDefault()
              submitCreate()
            }
          }}
        >
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={`Search or add ${noun}...`}
          />
          <CommandList className="max-h-64">
            <CommandEmpty>No matches found.</CommandEmpty>
            <CommandGroup>
              {filtered.map((item) =>
                editingId === item.id ? (
                  <div
                    key={item.id}
                    className="flex flex-col gap-1.5 rounded-sm bg-muted/50 p-1.5"
                  >
                    {fields.map((field) => (
                      <FieldControl
                        key={field.key}
                        field={field}
                        value={editValues[field.key] ?? ''}
                        onChange={(v) =>
                          setEditValues((prev) => ({ ...prev, [field.key]: v }))
                        }
                        onSubmit={saveEdit}
                      />
                    ))}
                    <div className="flex justify-end gap-1">
                      <Button size="xs" variant="ghost" onClick={cancelEdit}>
                        <X className="size-3.5" />
                        Cancel
                      </Button>
                      <Button size="xs" onClick={saveEdit}>
                        <Check className="size-3.5" />
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <CommandItem
                    key={item.id}
                    value={`${getLabel(item)} ${getMeta?.(item) ?? ''}`}
                    onSelect={() => startEdit(item)}
                    className="group/edit gap-2 pr-1"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {getLabel(item)}
                      {getMeta?.(item) && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {getMeta(item)}
                        </span>
                      )}
                      {!item.custom && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (standard)
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/edit:opacity-100 group-focus-within/edit:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Rename ${getLabel(item)}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          startEdit(item)
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove ${getLabel(item)}`}
                        className="text-red-600 hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(item.id)
                          toast.success(`${cap(noun)} removed.`)
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </span>
                  </CommandItem>
                ),
              )}
            </CommandGroup>
          </CommandList>

          {showCreate && (
            <div className="border-t p-1.5">
              <div className="flex flex-col gap-1.5">
                {fields.map((field) => (
                  <FieldControl
                    key={field.key}
                    field={field}
                    value={createValues[field.key] ?? ''}
                    onChange={(v) =>
                      setCreateValues((prev) => ({ ...prev, [field.key]: v }))
                    }
                  />
                ))}
                <Button size="sm" variant="outline" onClick={submitCreate}>
                  <Plus className="size-3.5" />
                  Add {noun}
                </Button>
              </div>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}

interface FieldControlProps {
  field: ListEditorField
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
}

function FieldControl({ field, value, onChange, onSubmit }: FieldControlProps) {
  if (field.options) {
    return (
      <div
        role="group"
        aria-label={field.label}
        className="flex gap-1"
      >
        {field.options.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            size="xs"
            variant={value === opt.value ? 'default' : 'outline'}
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    )
  }

  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onSubmit) {
          e.preventDefault()
          onSubmit()
        }
      }}
      placeholder={field.placeholder}
      aria-label={field.label}
      className={cn('h-8', field.className ?? 'flex-1')}
    />
  )
}

function cap(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function plural(noun: string) {
  // "voice position" -> "voice positions"; irregulars are not needed here.
  if (/(s|x|z|ch|sh)$/.test(noun)) return `${noun}es`
  if (/[^aeiou]y$/.test(noun)) return `${noun.slice(0, -1)}ies`
  return `${noun}s`
}
