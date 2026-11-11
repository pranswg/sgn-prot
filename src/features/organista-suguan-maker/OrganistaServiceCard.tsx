import type { DragEvent, Ref } from 'react'
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Copy,
  GripVertical,
  MoreVertical,
  Pencil,
  Piano,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { OrganistaSuguanService } from '@/core/types/organistaSuguan'
import { MemberPicker } from './memberPicker'

interface OrganistaServiceCardProps {
  service: OrganistaSuguanService
  index: number
  count: number
  /** This card is the one being dragged. */
  dragging: boolean
  /** The pointer is over this card while another one is dragged. */
  dropTarget: boolean
  cardRef?: Ref<HTMLElement>
  onOrganistChange: (name: string) => void
  onReserveChange: (name: string) => void
  onChangeSchedule: () => void
  onMove: (direction: -1 | 1) => void
  onDuplicate: () => void
  onRemove: () => void
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void
  onDragEnd: () => void
  onDragOver: (event: DragEvent<HTMLElement>) => void
  onDragLeave: () => void
  onDrop: (event: DragEvent<HTMLElement>) => void
}

/**
 * One schedule row of an Organist Suguan: the service it covers, and the
 * Organista and Reserba covering it. The reorder, duplicate and remove actions
 * live behind a single kebab; the schedule itself is the tappable row, so
 * changing the service is one click rather than a menu trip.
 */
export function OrganistaServiceCard({
  service,
  index,
  count,
  dragging,
  dropTarget,
  cardRef,
  onOrganistChange,
  onReserveChange,
  onChangeSchedule,
  onMove,
  onDuplicate,
  onRemove,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: OrganistaServiceCardProps) {
  const label = service.heading || `Service ${index + 1}`
  const assigned = service.organist.trim() !== ''

  return (
    <article
      ref={cardRef}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'rounded-xl border border-border/70 bg-card p-3 transition-colors',
        dragging && 'opacity-60',
        dropTarget && 'border-primary ring-1 ring-primary',
      )}
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden="true"
          className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-muted text-[11px] font-bold text-muted-foreground"
        >
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onChangeSchedule}
            aria-label={`Change the worship schedule of ${label}`}
            className="flex min-h-6 w-full items-center gap-2 rounded-md text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0 truncate text-sm font-semibold text-foreground">
              {service.dayName || service.heading}
            </span>
            {service.scheduleTime && (
              <span className="shrink-0 text-sm font-semibold text-foreground">
                {service.scheduleTime}
              </span>
            )}
            <Pencil
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </button>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {service.categoryLabel || 'Worship service'}
            {!assigned && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold tracking-normal text-amber-800 normal-case dark:bg-amber-500/15 dark:text-amber-300">
                Unassigned
              </span>
            )}
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Drag to reorder"
          aria-label={`Drag ${label} to reorder`}
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className="cursor-grab text-muted-foreground"
        >
          <GripVertical className="size-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${label}`}
              className="text-muted-foreground hover:text-foreground"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(-1)}>
              <ArrowUp className="size-4" />
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={index === count - 1}
              onSelect={() => onMove(1)}
            >
              <ArrowDown className="size-4" />
              Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onChangeSchedule}>
              <CalendarClock className="size-4" />
              Change schedule
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDuplicate}>
              <Copy className="size-4" />
              Duplicate
            </DropdownMenuItem>
            {count > 1 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={onRemove}>
                  <Trash2 className="size-4" />
                  Remove
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 grid gap-3 border-t border-border/70 pt-3 md:grid-cols-2">
        <div className="grid min-w-0 gap-1.5">
          <Label
            htmlFor={`service-organist-${service.id}`}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          >
            <Piano className="size-3.5" aria-hidden="true" />
            Organista
          </Label>
          <MemberPicker
            id={`service-organist-${service.id}`}
            label="Organista"
            value={service.organist}
            onChange={onOrganistChange}
            exclude={[service.reserve]}
            placeholder="Select Organista…"
            className="h-10"
          />
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label
            htmlFor={`service-reserve-${service.id}`}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          >
            <Piano className="size-3.5" aria-hidden="true" />
            Reserba
          </Label>
          <MemberPicker
            id={`service-reserve-${service.id}`}
            label="Backup Organista"
            value={service.reserve}
            onChange={onReserveChange}
            exclude={[service.organist]}
            allowNA
            placeholder="Select backup Organista…"
            className="h-10"
          />
        </div>
      </div>
    </article>
  )
}
