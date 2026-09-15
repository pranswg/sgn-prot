import { CalendarDays, Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { SuguanType } from '@/core/types/suguan'
import { cn } from '@/lib/utils'

interface ModeSelectStepProps {
  value: SuguanType | ''
  onSelect: (type: SuguanType) => void
}

const MODES: {
  type: SuguanType
  title: string
  description: string
  points: string[]
}[] = [
  {
    type: 'regular',
    title: 'Regular Worship Service',
    description:
      'For normal weekly worship services. The focus is who is assigned to sing, producing the official Suguan attendance and signature sheet.',
    points: ['Voice assignments & duty roles', 'Pagsasanay / Pagtupad columns', 'Print-ready SUGUAN sheet'],
  },
  {
    type: 'special',
    title: 'Special Occasion',
    description:
      'For anniversaries, district events, and choir presentations. The focus is who is assigned and where they stand using the Koro formation planner.',
    points: ['Event information', 'Koro Maker formation grid', 'Formation layout exports'],
  },
]

export function ModeSelectStep({ value, onSelect }: ModeSelectStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Select Suguan Mode</h2>
        <p className="text-sm text-muted-foreground">
          Regular worship services and special occasions have different
          workflows. Choose the mode that matches what you are scheduling.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {MODES.map((mode) => {
          const Icon = mode.type === 'regular' ? CalendarDays : Sparkles
          const active = value === mode.type
          return (
            <button
              key={mode.type}
              type="button"
              onClick={() => onSelect(mode.type)}
              className={cn(
                'rounded-xl border p-5 text-left transition-colors',
                active
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'hover:bg-accent',
              )}
            >
              <Card className="border-0 bg-transparent shadow-none">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="size-4 text-primary" />
                      {mode.title}
                    </CardTitle>
                    <CardDescription className="pt-1">
                      {mode.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pt-2 text-sm">
                  <ul className="flex flex-col gap-1">
                    {mode.points.map((p) => (
                      <li key={p} className="text-muted-foreground">
                        · {p}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </button>
          )
        })}
      </div>
    </div>
  )
}