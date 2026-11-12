import { CircleAlert } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useProblemStore } from '@/store/problemStore'

/**
 * The one app-level host for the shared problem window. Mount once (in `App`);
 * any caller opens it through `showProblems(...)` in `problemStore`. Renders the
 * whole list at once so a blocked save or export shows every reason, not just
 * the first — the reason this exists over a top toast.
 */
export function ProblemDialogHost() {
  const open = useProblemStore((state) => state.open)
  const title = useProblemStore((state) => state.title)
  const description = useProblemStore((state) => state.description)
  const problems = useProblemStore((state) => state.problems)
  const close = useProblemStore((state) => state.close)

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <CircleAlert className="size-5" />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <ul className="flex flex-col gap-2 text-sm text-foreground">
          {problems.map((problem, index) => (
            <li
              key={`${index}:${problem}`}
              className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2"
            >
              <span
                aria-hidden
                className="mt-1 size-1.5 shrink-0 rounded-full bg-destructive"
              />
              <span>{problem}</span>
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogAction onClick={close}>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
