import { PositionBadge } from '@/components/StatusBadges'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { positionSummary } from '@/core/constants/choirPositions'
import type { ChoirPosition } from '@/core/types/member'

interface MemberPositionsCellProps {
  positions: ChoirPosition[] | undefined
  max?: number
}

export function MemberPositionsCell({
  positions,
  max = 2,
}: MemberPositionsCellProps) {
  const list = positions ?? []

  if (list.length === 0) {
    return (
      <span className="text-xs text-muted-foreground/60" aria-label="No positions">
        &mdash;
      </span>
    )
  }

  const visible = list.slice(0, max)
  const overflow = list.length - visible.length
  const summary = positionSummary(list)

  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-1"
      title={summary}
    >
      {visible.map((position) => (
        <PositionBadge key={position} position={position} />
      ))}
      {overflow > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              className="inline-flex h-5 cursor-default items-center rounded-md border border-border bg-muted px-1.5 text-[0.6875rem] font-medium tabular-nums text-muted-foreground"
            >
              +{overflow} more
            </span>
          </TooltipTrigger>
          <TooltipContent>{summary}</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
