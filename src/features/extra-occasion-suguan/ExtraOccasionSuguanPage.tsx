import { useState } from 'react'
import { CalendarPlus, CalendarRange } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { useNavStore } from '@/store/navStore'
import { ExtraOccasionModeDialog } from './ExtraOccasionModeDialog'
import { ExtraOccasionSingleMaker } from './ExtraOccasionSingleMaker'
import { MultipleExtraOccasionPlanner } from './MultipleExtraOccasionPlanner'

/**
 * The Extra Occasion route. Shows the Single/Multiple chooser until a workflow
 * is picked, then either the standalone maker or the planning session.
 */
export function ExtraOccasionSuguanPage() {
  const mode = useNavStore((state) => state.extraOccasionMode)
  const extraOccasionSuguanId = useNavStore((state) => state.extraOccasionSuguanId)
  const setExtraOccasionMode = useNavStore((state) => state.setExtraOccasionMode)

  // Editing a saved record always means the single maker.
  if (extraOccasionSuguanId || mode === 'single') {
    return <ExtraOccasionSingleMaker />
  }
  if (mode === 'multi') {
    return <MultipleExtraOccasionPlanner />
  }
  return <ExtraOccasionChooser onChoose={setExtraOccasionMode} />
}

function ExtraOccasionChooser({
  onChoose,
}: {
  onChoose: (mode: 'single' | 'multi') => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="flex flex-col gap-5 pb-10">
      <PageHeader
        title="Extra Occasion Suguan"
        description="Build one custom-date sign-up sheet, or plan several occasions together with shared member-conflict checks."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onChoose('single')}
          className="flex flex-col items-start gap-1.5 rounded-xl border p-5 text-left transition-colors hover:border-primary hover:bg-accent"
        >
          <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <CalendarPlus className="size-4" />
          </span>
          <span className="text-sm font-semibold">Single Extra Occasion</span>
          <span className="text-xs text-muted-foreground">
            One sheet with custom dates, labels, and signatories.
          </span>
        </button>
        <button
          type="button"
          onClick={() => onChoose('multi')}
          className="flex flex-col items-start gap-1.5 rounded-xl border p-5 text-left transition-colors hover:border-primary hover:bg-accent"
        >
          <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <CalendarRange className="size-4" />
          </span>
          <span className="text-sm font-semibold">Multiple Extra Occasions</span>
          <span className="text-xs text-muted-foreground">
            Plan several occasions at once and catch member conflicts.
          </span>
        </button>
      </div>

      <ExtraOccasionModeDialog
        open={open}
        onOpenChange={setOpen}
        onChoose={(choice) => {
          setOpen(false)
          onChoose(choice)
        }}
      />
    </div>
  )
}
