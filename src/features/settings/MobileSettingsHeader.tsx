import { ChevronLeft, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { initialsFor } from '@/lib/credentials'
import { useAuthStore } from '@/store/authStore'
import { useNavStore } from '@/store/navStore'

/**
 * The phone-sized stand-in for the global bar.
 *
 * `Layout` hides its navy bar on Settings for the same reason it does on the
 * Master List: the page owns its own top row, and two "Settings" titles stacked
 * on one screen read as a bug. The row cancels the page padding
 * (`-mx-4 -mt-5`) so it stays flush with the viewport edge while the page
 * scrolls underneath it.
 */
export function MobileSettingsHeader() {
  const goBack = useNavStore((s) => s.goBack)
  const signOut = useAuthStore((s) => s.signOut)
  const currentAccountId = useAuthStore((s) => s.currentAccountId)
  const account = useAuthStore((s) =>
    s.accounts.find((a) => a.id === currentAccountId),
  )

  return (
    <div className="sticky top-0 z-30 -mx-4 -mt-5 flex h-14 shrink-0 items-center gap-1 border-b border-border/70 bg-background px-2 md:hidden">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Back"
        onClick={() => goBack()}
      >
        <ChevronLeft className="size-4" />
      </Button>

      <p className="min-w-0 flex-1 truncate text-base leading-tight font-semibold tracking-tight">
        Settings
      </p>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Signed in as ${account?.fullName ?? 'unknown'}`}
            className="mr-1 flex size-8 items-center justify-center rounded-full bg-brand-navy text-[0.6875rem] font-semibold tracking-tight text-white ring-1 ring-inset ring-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            {account ? initialsFor(account.fullName) : '?'}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="grid gap-0.5">
            <span className="truncate text-sm font-medium">
              {account?.fullName}
            </span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              @{account?.username}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => signOut()}>
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
