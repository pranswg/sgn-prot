import type { ReactNode } from 'react'
import { GraduationCap, Music2, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { DirectoryStats } from '@/lib/memberDirectory'

interface SummaryCardsProps {
  stats: DirectoryStats
}

interface CardShellProps {
  label: string
  icon: typeof Users
  iconWrapClass: string
  iconClass: string
  children: ReactNode
}

function CardShell({
  label,
  icon: Icon,
  iconWrapClass,
  iconClass,
  children,
}: CardShellProps) {
  return (
    <Card className="gap-0 rounded-xl border-border/70 bg-card py-0 shadow-none transition-colors hover:border-brand-teal/30">
      <CardContent className="flex h-full flex-col gap-2.5 p-4">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-md',
              iconWrapClass,
            )}
          >
            <Icon className={cn('size-4', iconClass)} />
          </span>
          <p className="truncate text-[0.8125rem] font-medium text-foreground/80">
            {label}
          </p>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

const VOICE_TONE = [
  'bg-sky-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-blue-600',
  'bg-slate-500',
  'bg-brand-teal',
]

export function DirectorySummaryCards({ stats }: SummaryCardsProps) {
  const voiceTotal = stats.voiceCounts.reduce((sum, v) => sum + v.count, 0)
  const voiceMax = Math.max(1, ...stats.voiceCounts.map((v) => v.count))

  return (
    <div className="hidden grid-cols-1 gap-3 sm:grid-cols-2 md:grid md:grid-cols-3">
      <CardShell
        label="Total Members"
        icon={Users}
        iconWrapClass="bg-brand-navy-soft"
        iconClass="text-brand-navy"
      >
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold leading-none tracking-tight tabular-nums">
            {stats.total}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-emerald-600 dark:text-emerald-400">
            {stats.active} active
          </span>{' '}
          &middot; {stats.inactive} inactive
        </p>
      </CardShell>

      <CardShell
        label="Trainees"
        icon={GraduationCap}
        iconWrapClass="bg-violet-500/10"
        iconClass="text-violet-600 dark:text-violet-400"
      >
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold leading-none tracking-tight tabular-nums">
            {stats.trainees}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Currently in the trainee program
        </p>
      </CardShell>

      <CardShell
        label="Voice Distribution"
        icon={Music2}
        iconWrapClass="bg-sky-500/10"
        iconClass="text-sky-600 dark:text-sky-400"
      >
        {stats.voiceCounts.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No voices configured
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {stats.voiceCounts.map((voice, i) => (
              <li key={voice.id} className="flex items-center gap-2">
                <span className="w-16 shrink-0 truncate text-[0.6875rem] text-muted-foreground">
                  {voice.name}
                </span>
                <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn(
                      'block h-full rounded-full',
                      VOICE_TONE[i % VOICE_TONE.length],
                    )}
                    style={{
                      width: `${Math.max(6, (voice.count / voiceMax) * 100)}%`,
                    }}
                  />
                </span>
                <span className="w-5 shrink-0 text-right text-[0.6875rem] font-semibold tabular-nums text-foreground/80">
                  {voice.count}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          {voiceTotal} members assigned to a voice
        </p>
      </CardShell>
    </div>
  )
}
