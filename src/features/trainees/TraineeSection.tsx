import { ChevronDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TraineeStatusBadge, VoiceBadge } from '@/components/StatusBadges'
import type { Trainee } from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'
import { getVoiceName } from '@/core/constants/voicePositions'
import { formatAddedDate } from '@/lib/format'
import { formatMemberName, memberInitials } from '@/lib/memberDirectory'
import { cn } from '@/lib/utils'
import { TraineeRowActions } from './TraineeRowActions'

const headClass =
  'h-11 bg-background text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground'

interface TraineeSectionProps {
  title: string
  icon: typeof ChevronDown
  iconClass: string
  trainees: Trainee[]
  voices: VoicePosition[]
  collapsed: boolean
  onToggle: () => void
  onPromote: (trainee: Trainee) => void
  onRestore: (trainee: Trainee) => void
  onEdit: (trainee: Trainee) => void
  onTransfer: (trainee: Trainee) => void
  onRemove: (trainee: Trainee) => void
}

/** One choir's trainees: a tinted band, phone cards, and the desktop table. */
export function TraineeSection({
  title,
  icon: Icon,
  iconClass,
  trainees,
  voices,
  collapsed,
  onToggle,
  onPromote,
  onRestore,
  onEdit,
  onTransfer,
  onRemove,
}: TraineeSectionProps) {
  const actions = { onPromote, onRestore, onEdit, onTransfer, onRemove }

  return (
    <section className="flex flex-col gap-2 md:gap-0 md:overflow-hidden md:rounded-xl md:border md:border-border/70 md:bg-card">
      <button
        type="button"
        aria-expanded={!collapsed}
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg bg-brand-teal-soft/40 px-3 py-2.5 text-left transition-colors active:bg-brand-teal-soft/60',
          'md:rounded-none md:border-b md:border-border/60 md:bg-brand-teal-soft/35 md:px-4 md:hover:bg-brand-teal-soft/55',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        )}
      >
        <Icon className={cn('size-3.5 shrink-0', iconClass)} />
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-foreground/75">
          {title}
        </span>
        <span className="rounded border border-border bg-card px-1.5 text-[0.625rem] font-semibold tabular-nums text-muted-foreground md:bg-background">
          {trainees.length}
        </span>
        <span className="truncate text-[0.625rem] tabular-nums text-muted-foreground/60">
          #1–#{trainees.length} of #{trainees.length}
        </span>
        <ChevronDown
          className={cn(
            'ml-auto size-4 shrink-0 text-muted-foreground transition-transform',
            collapsed && '-rotate-90',
          )}
        />
      </button>

      {collapsed ? null : (
        <>
          <ul className="flex flex-col gap-2 md:hidden">
            {trainees.map((trainee) => (
              <li
                key={trainee.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3.5 shadow-sm"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-teal-soft text-[0.8125rem] font-semibold tracking-tight text-brand-teal">
                  {memberInitials(trainee)}
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                    {formatMemberName(trainee)}
                  </p>
                  <p className="mt-1 truncate text-[0.6875rem] text-muted-foreground">
                    {getVoiceName(trainee.voicePosition, voices)}
                    <span aria-hidden> · </span>
                    Added {formatAddedDate(trainee.dateAdded)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <TraineeStatusBadge status={trainee.status} />
                  <TraineeRowActions trainee={trainee} {...actions} />
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={`${headClass} w-14 text-center`}>
                    #
                  </TableHead>
                  <TableHead className={headClass}>Trainee</TableHead>
                  <TableHead className={headClass}>Voice Position</TableHead>
                  <TableHead className={headClass}>Status</TableHead>
                  <TableHead className={`${headClass} w-12 text-right`}>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trainees.map((trainee, index) => (
                  <TableRow
                    key={trainee.id}
                    className="h-14 border-b border-border transition-colors hover:bg-background"
                  >
                    <TableCell className="w-14 text-center align-middle">
                      <span className="inline-flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                        {index + 1}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-teal-soft text-[0.6875rem] font-semibold tracking-tight text-brand-teal">
                          {memberInitials(trainee)}
                        </span>
                        <div className="min-w-0 leading-tight">
                          <p className="truncate text-[0.8125rem] font-semibold text-foreground">
                            {formatMemberName(trainee)}
                          </p>
                          <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
                            Added {formatAddedDate(trainee.dateAdded)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <VoiceBadge
                        name={getVoiceName(trainee.voicePosition, voices)}
                      />
                    </TableCell>
                    <TableCell>
                      <TraineeStatusBadge status={trainee.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <TraineeRowActions trainee={trainee} {...actions} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </section>
  )
}
