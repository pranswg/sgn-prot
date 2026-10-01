import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * Light/dark switch, reading and writing `next-themes` rather than
 * localStorage directly. That library owns three states the spec asks for at
 * once: follow the OS on first load, persist an explicit choice, and keep
 * following the OS if the user never chose.
 *
 * `resolvedTheme` is what decides which glyph to draw. `theme` would report the
 * literal string `"system"` and there is no sun icon for that.
 */
export function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const nextLabel = isDark ? 'Light Mode' : 'Dark Mode'

  const toggle = () => setTheme(isDark ? 'light' : 'dark')

  const row = (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${nextLabel}`}
      className={cn(
        'flex w-full items-center rounded-lg text-sidebar-secondary',
        'transition-colors duration-150 ease-in-out motion-reduce:transition-none',
        'hover:bg-sidebar-hover hover:text-sidebar-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        collapsed ? 'size-11 justify-center rounded-xl' : 'h-[38px] gap-2.5 px-3',
      )}
    >
      <span className="relative flex size-[17px] shrink-0 items-center justify-center">
        <Sun
          className={cn(
            'absolute size-[17px] transition-all duration-300 ease-in-out motion-reduce:transition-none',
            isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100',
          )}
          aria-hidden="true"
        />
        <Moon
          className={cn(
            'absolute size-[17px] transition-all duration-300 ease-in-out motion-reduce:transition-none',
            isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0',
          )}
          aria-hidden="true"
        />
      </span>
      <span
        className={cn(
          'truncate text-sm font-medium transition-all duration-300 ease-in-out motion-reduce:transition-none',
          collapsed ? 'max-w-0 overflow-hidden opacity-0' : 'max-w-[160px] opacity-100',
        )}
      >
        {nextLabel}
      </span>
    </button>
  )

  // px-1 matches the nav rows and the org card, so every full-width row in the
  // footer lines up on the same 4px inset.
  if (!collapsed) return <div className="px-1">{row}</div>

  return (
    <div className="grid h-11 place-items-center">
      <Tooltip>
        <TooltipTrigger asChild>{row}</TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={12}
          align="center"
          className="border-sidebar-border bg-sidebar text-sidebar-foreground"
        >
          Switch to {nextLabel}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}