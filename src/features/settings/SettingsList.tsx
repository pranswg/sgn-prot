import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { ReferenceForm } from './ReferenceForm'
import {
  cap,
  plural,
  referenceProblem,
  valuesFrom,
  type ReferenceField,
  type ReferenceValues,
} from './referenceList'

export interface SettingsListProps<T extends { id: string }> {
  items: T[]
  title: string
  description: string
  /** Lowercase singular, used to build "Add service type" and the toasts. */
  noun: string
  fields: ReferenceField[]
  getLabel: (item: T) => string
  /** Secondary text beside the name, e.g. a duty role's abbreviation. */
  getMeta?: (item: T) => string | undefined
  /** Optional metadata badges, e.g. a voice's gender. */
  extraBadges?: (item: T) => ReactNode
  /** When provided the list gains a "Set as default" control; the item whose id
   * matches `defaultId` is marked as the current default. */
  defaultId?: string | null
  onSetDefault?: (id: string) => void
  onCreate: (values: ReferenceValues) => void
  onUpdate: (id: string, values: ReferenceValues) => void
  onDelete: (id: string) => void
  onMove: (id: string, toIndex: number) => void
  className?: string
}

/**
 * One management card for one reference list.
 *
 * The card starts collapsed on both breakpoints: the header is a toggle, so
 * the page reads as a short list of sections rather than every entry dumped on
 * screen at once. The same component renders the desktop card and the mobile
 * card, with the form presented as a dialog on desktop and a bottom sheet on a
 * phone, so the two breakpoints cannot drift into different rules.
 */
export function SettingsList<T extends { id: string }>({
  items,
  title,
  description,
  noun,
  fields,
  getLabel,
  getMeta,
  extraBadges,
  defaultId,
  onSetDefault,
  onCreate,
  onUpdate,
  onDelete,
  onMove,
  className,
}: SettingsListProps<T>) {
  const isMobile = useIsMobile()
  const [expanded, setExpanded] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)
  const [values, setValues] = useState<ReferenceValues>({})
  const [pendingDelete, setPendingDelete] = useState<T | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const nameKey = fields[0]?.key ?? 'name'
  const existing = items.map((item) => ({ id: item.id, label: getLabel(item) }))
  const problem = referenceProblem(
    values[nameKey] ?? '',
    existing,
    editing?.id ?? null,
  )
  const editingIndex =
    editing === null ? -1 : items.findIndex((item) => item.id === editing.id)

  const openAdd = () => {
    setExpanded(true)
    setEditing(null)
    setValues(
      Object.fromEntries(
        fields.map((field) => [
          field.key,
          field.options ? (field.options[0]?.value ?? '') : '',
        ]),
      ),
    )
    setFormOpen(true)
  }

  const openEdit = (item: T) => {
    setEditing(item)
    setValues(valuesFrom(item, fields))
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditing(null)
  }

  const save = () => {
    if (problem) return
    if (editing) {
      onUpdate(editing.id, values)
      toast.success(`${cap(noun)} updated.`)
    } else {
      onCreate(values)
      toast.success(`${cap(noun)} added.`)
    }
    closeForm()
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    onDelete(pendingDelete.id)
    toast.success(`${cap(noun)} removed.`)
    setPendingDelete(null)
  }

  const move = (item: T, toIndex: number) => onMove(item.id, toIndex)

  const form = (
    <ReferenceForm
      fields={fields}
      values={values}
      onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
      problem={problem}
      onSubmit={save}
    >
      {isMobile ? (
        <div className="flex flex-col gap-3 border-t border-border/60 pt-4">
          {editing && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={editingIndex <= 0}
                onClick={() => move(editing, editingIndex - 1)}
              >
                <ArrowUp className="size-4" />
                Move up
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={editingIndex >= items.length - 1}
                onClick={() => move(editing, editingIndex + 1)}
              >
                <ArrowDown className="size-4" />
                Move down
              </Button>
            </div>
          )}
          {editing && (
            <Button
              type="button"
              variant="outline"
              className="w-full text-red-600 hover:border-red-600/30 hover:text-red-600"
              onClick={() => {
                const target = editing
                closeForm()
                setPendingDelete(target)
              }}
            >
              <Trash2 className="size-4" />
              Remove {noun}
            </Button>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={closeForm}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={!!problem}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <DialogFooter>
          <Button type="button" variant="outline" onClick={closeForm}>
            Cancel
          </Button>
          <Button type="submit" disabled={!!problem}>
            Save
          </Button>
        </DialogFooter>
      )}
    </ReferenceForm>
  )

  return (
    <section className={cn('flex flex-col', className)}>
      <Card>
        <CardHeader>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
            className="flex min-w-0 items-start gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base leading-snug font-medium text-foreground">
                {title}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {description}
              </span>
            </span>
            <ChevronDown
              className={cn(
                'mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                expanded && 'rotate-180',
              )}
            />
          </button>
          <CardAction>
            {isMobile ? (
              <Button
                size="icon-sm"
                aria-label={`Add ${noun}`}
                onClick={openAdd}
              >
                <Plus className="size-4" />
              </Button>
            ) : (
              <Button size="sm" onClick={openAdd}>
                <Plus className="size-3.5" />
                Add {cap(noun)}
              </Button>
            )}
          </CardAction>
        </CardHeader>

        {expanded && (
          <CardContent>
            {items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No {plural(noun)} yet.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {items.map((item, index) => (
                  <ListRow
                    key={item.id}
                    index={index}
                    label={getLabel(item)}
                    meta={getMeta?.(item)}
                    badges={
                      <>
                        {extraBadges?.(item)}
                      </>
                    }
                    compact={isMobile}
                    isDefault={
                      onSetDefault !== undefined && item.id === defaultId
                    }
                    onToggleDefault={
                      onSetDefault ? () => onSetDefault(item.id) : null
                    }
                    dragging={dragId === item.id}
                    dropTarget={
                      dragId !== null && overId === item.id && dragId !== item.id
                    }
                    onDragStart={() => setDragId(item.id)}
                    onDragOver={() => {
                      if (dragId && dragId !== item.id) setOverId(item.id)
                    }}
                    onDragEnd={() => {
                      setDragId(null)
                      setOverId(null)
                    }}
                    onDrop={() => {
                      if (dragId && dragId !== item.id) onMove(dragId, index)
                      setDragId(null)
                      setOverId(null)
                    }}
                    onMove={(toIndex) => move(item, toIndex)}
                    onEdit={() => openEdit(item)}
                    onRemove={() => setPendingDelete(item)}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        )}
      </Card>

      {isMobile ? (
        <Sheet
          open={formOpen}
          onOpenChange={(open) => {
            if (!open) closeForm()
          }}
        >
          <SheetContent
            side="bottom"
            className="max-h-[85dvh] gap-0 rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]"
          >
            <SheetHeader className="border-b border-border/70 pr-14">
              <SheetTitle>
                {editing ? `Edit ${cap(noun)}` : `Add ${cap(noun)}`}
              </SheetTitle>
              <SheetDescription>{description}</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4">{form}</div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog
          open={formOpen}
          onOpenChange={(open) => {
            if (!open) closeForm()
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? `Edit ${cap(noun)}` : `Add ${cap(noun)}`}
              </DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            {form}
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {cap(noun)}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `“${getLabel(pendingDelete)}” will be removed from the list. You can add it back at any time.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white"
              onClick={confirmDelete}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

interface ListRowProps {
  index: number
  label: string
  meta?: string
  badges: ReactNode
  /** Mobile rows are one tappable line; desktop rows carry drag and actions. */
  compact: boolean
  isDefault: boolean
  onToggleDefault: (() => void) | null
  dragging: boolean
  dropTarget: boolean
  onDragStart: () => void
  onDragOver: () => void
  onDragEnd: () => void
  onDrop: () => void
  onMove: (toIndex: number) => void
  onEdit: () => void
  onRemove: () => void
}

function ListRow({
  index,
  label,
  meta,
  badges,
  compact,
  isDefault,
  onToggleDefault,
  dragging,
  dropTarget,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onMove,
  onEdit,
  onRemove,
}: ListRowProps) {
  if (compact) {
    return (
      <li className="flex w-full items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="pressable flex min-w-0 flex-1 items-center gap-3 py-3 text-left active:bg-muted/60 motion-reduce:transform-none"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">
              {label}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              {badges}
              {meta && (
                <span className="text-xs text-muted-foreground">{meta}</span>
              )}
            </span>
          </span>
          {!onToggleDefault && (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
          )}
        </button>
        {onToggleDefault && (
          <button
            type="button"
            onClick={onToggleDefault}
            aria-label={
              isDefault
                ? `Stop using ${label} as the default`
                : `Use ${label} as the default`
            }
            title={
              isDefault ? 'Default service type' : 'Set as default service type'
            }
            className={cn(
              'shrink-0 rounded-md p-3 text-muted-foreground transition-colors hover:text-foreground active:bg-muted/60',
              isDefault && 'text-amber-500',
            )}
          >
            <Star
              className={cn('size-4', isDefault && 'fill-current')}
            />
          </button>
        )}
      </li>
    )
  }

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(index))
        onDragStart()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        onDragOver()
      }}
      onDragEnd={onDragEnd}
      onDrop={(e) => {
        e.preventDefault()
        onDrop()
      }}
      className={cn(
        'flex items-center gap-3 py-2.5 transition-colors',
        'hover:bg-muted/40',
        dragging && 'opacity-40',
        dropTarget && 'bg-brand-teal-soft/60',
      )}
    >
      <button
        type="button"
        aria-label={`Reorder ${label}`}
        title="Drag to reorder, or use the arrow keys"
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            onMove(index - 1)
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            onMove(index + 1)
          }
        }}
        className="shrink-0 cursor-grab text-muted-foreground/50 transition-colors hover:text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>

      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {label}
      </span>

      {meta && (
        <span className="shrink-0 rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground tabular-nums">
          {meta}
        </span>
      )}

      <span className="flex shrink-0 items-center gap-1.5">{badges}</span>

      {onToggleDefault &&
        (isDefault ? (
          <Badge
            variant="secondary"
            className="shrink-0 gap-1 border-transparent text-amber-700 dark:text-amber-400"
          >
            <Star className="size-3 fill-current" /> Default
          </Badge>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1 text-muted-foreground hover:text-foreground"
            onClick={onToggleDefault}
          >
            <Star className="size-3.5" /> Set as default
          </Button>
        ))}

      <span className="flex shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${label}`}
          className="text-muted-foreground hover:text-foreground"
          onClick={onEdit}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${label}`}
          className="text-muted-foreground hover:text-red-600"
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </span>
    </li>
  )
}
