import { CalendarPlus, CalendarRange } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ExtraOccasionModeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (mode: 'single' | 'multi') => void
}

/**
 * The Single/Multiple choice shown when the Extra Occasion page is opened from
 * the sidebar. Single is the original maker, unchanged; Multiple opens the
 * planning-session workflow.
 */
export function ExtraOccasionModeDialog({
  open,
  onOpenChange,
  onChoose,
}: ExtraOccasionModeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Which Extra Occasion workflow?</DialogTitle>
          <DialogDescription>
            Build one sign-up sheet, or plan several occasions together with
            shared member-conflict checks.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onChoose('single')}
            className="flex flex-col items-start gap-1.5 rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-accent"
          >
            <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <CalendarPlus className="size-4" />
            </span>
            <span className="text-sm font-semibold">Single Extra Occasion</span>
            <span className="text-xs text-muted-foreground">
              One sheet with its own dates, labels, and signatories.
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChoose('multi')}
            className="flex flex-col items-start gap-1.5 rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-accent"
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

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
