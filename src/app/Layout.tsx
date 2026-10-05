import { useEffect, useState } from 'react'
import {
  ChevronRight,
  LogOut,
  Menu,
  Music4,
  Settings2,
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AppSidebar } from '@/components/AppSidebar'
import { MobileBottomNav } from '@/components/MobileBottomNav'
import { useNavStore, type Page } from '@/store/navStore'
import { useAuthStore } from '@/store/authStore'
import { useSidebarStore } from '@/store/sidebarStore'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { MasterListPage } from '@/features/master-list/MasterListPage'
import { TraineePage } from '@/features/trainees/TraineePage'
import { SuguanBuilderPage } from '@/features/suguan-builder/SuguanBuilderPage'
import { SuguanHistoryPage } from '@/features/suguan-history/SuguanHistoryPage'
import { SuguanDetailPage } from '@/features/suguan-history/SuguanDetailPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { formatPHTDateTime } from '@/lib/phDate'
import { initialsFor } from '@/lib/credentials'

function CurrentPage() {
  const page = useNavStore((s) => s.page)
  switch (page) {
    case 'master-list':
      return <MasterListPage />
    case 'trainees':
      return <TraineePage />
    case 'suguan-builder':
      return <SuguanBuilderPage />
    case 'suguan-history':
      return <SuguanHistoryPage />
    case 'suguan-detail':
      return <SuguanDetailPage />
    case 'settings':
      return <SettingsPage />
    case 'dashboard':
    default:
      return <DashboardPage />
  }
}

const PAGE_META: Record<
  Page,
  { group: string; title: string; subtitle: string }
> = {
  dashboard: {
    group: 'Overview',
    title: 'Dashboard',
    subtitle: 'Choir overview, upcoming Suguan, and quick actions.',
  },
  'master-list': {
    group: 'Choir Management',
    title: 'Master List',
    subtitle:
      'Manage choir members, trainees, voice assignments, and choir positions.',
  },
  trainees: {
    group: 'Choir Management',
    title: 'Trainees',
    subtitle: 'Track choir trainees and promote them into the Master List.',
  },
  'suguan-builder': {
    group: 'Suguan',
    title: 'Suguan Builder',
    subtitle: 'Build worship service schedules, assignments, and duty roles.',
  },
  'suguan-history': {
    group: 'Suguan',
    title: 'Suguan History',
    subtitle: 'Review, print, and export past Suguan documents.',
  },
  'suguan-detail': {
    group: 'Suguan',
    title: 'Suguan Detail',
    subtitle: 'Review a saved Suguan schedule and its assignments.',
  },
  settings: {
    group: 'System',
    title: 'Settings',
    subtitle:
      'Configure voices, choir positions, duty roles, and service types.',
  },
}

function Breadcrumb() {
  const page = useNavStore((s) => s.page)
  const navigate = useNavStore((s) => s.navigate)
  const meta = PAGE_META[page]

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-[0.8125rem] leading-tight">
        <li className="hidden sm:block">
          <button
            type="button"
            onClick={() =>
              navigate(meta.group === 'Suguan' ? 'suguan-builder' : 'dashboard')
            }
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {meta.group}
          </button>
        </li>
        <li aria-hidden className="hidden text-muted-foreground/50 sm:block">
          <ChevronRight className="size-3.5" />
        </li>
        <li className="truncate font-semibold tracking-tight text-foreground">
          {meta.title}
        </li>
      </ol>
      {/* Settings prints this exact sentence as its page-header subtitle, so
          the breadcrumb copy is dropped there rather than showing it twice. */}
      {page !== 'settings' && (
        <p className="hidden truncate text-[0.6875rem] text-muted-foreground md:block">
          {meta.subtitle}
        </p>
      )}
    </nav>
  )
}

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

function CurrentDateTime() {
  const now = useNow()
  return (
    <div className="hidden flex-col items-end leading-tight sm:flex">
      <span className="text-xs font-medium text-foreground/80">
        {formatPHTDateTime(now, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </span>
      <span className="text-[0.6875rem] tabular-nums text-muted-foreground">
        {formatPHTDateTime(now, {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
        })}
        PHT
      </span>
    </div>
  )
}

export function Layout() {
  const navigate = useNavStore((s) => s.navigate)
  const page = useNavStore((s) => s.page)
  const meta = PAGE_META[page]
  const signOut = useAuthStore((s) => s.signOut)
  // Read the id so this only re-renders when the signed-in account changes,
  // not on every unrelated store write.
  const currentAccountId = useAuthStore((s) => s.currentAccountId)
  const account = useAuthStore((s) =>
    s.accounts.find((a) => a.id === currentAccountId),
  )
  const setMobileDrawerOpen = useSidebarStore((s) => s.setMobileDrawerOpen)

  return (
    // Plain flex row with no gutter. The sidebar is full-bleed and the content
    // sits flush beside it, so the app reads as one continuous surface rather
    // than a small panel floating in space. The sidebar is in normal flow, so
    // its width animation pushes the content instead of covering it. No
    // overlay on desktop.
    <div className="flex min-h-svh w-full">
      <AppSidebar />
      {/*
        The content area is a full page: no rounding, no border, no shadow, and
        no margin. `min-h-0` rather than `min-h-svh` because the wrapper is
        already `min-h-svh`; a second one here would be taller than the space it
        sits in and force a spurious scrollbar on short pages.
      */}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        {/*
          The Master List, Settings, and Suguan Detail render their own screen
          header and stick to the top on their own, so the global bar is hidden
          there rather than stacking two titles on one screen. The global bar
          matches the Master List header's light theming (`bg-background`,
          foreground text) so every mobile header is uniform.
        */}
        {page !== 'master-list' && page !== 'settings' && page !== 'suguan-detail' && (
          <div className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background px-3 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open navigation"
              onClick={() => setMobileDrawerOpen(true)}
            >
              <Menu className="size-4" />
            </Button>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Music4 className="size-4 shrink-0 text-brand-navy" />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                  {meta.title}
                </p>
                <p className="truncate text-[0.625rem] text-muted-foreground">
                  {meta.group} · INC Choir
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open settings"
              onClick={() => navigate('settings')}
            >
              <Settings2 className="size-4" />
            </Button>
          </div>
        )}

        <header className="sticky top-0 z-20 hidden h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur-sm md:flex md:px-6">
          <Breadcrumb />
          <div className="ml-auto flex items-center gap-3">
            <CurrentDateTime />
            <Separator orientation="vertical" className="hidden h-4 sm:block" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Open settings"
                  onClick={() => navigate('settings')}
                >
                  <Settings2 className="size-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Signed in as ${account?.fullName ?? 'unknown'}`}
                  className="flex size-8 items-center justify-center rounded-full bg-brand-navy text-[0.6875rem] font-semibold tracking-tight text-white ring-1 ring-inset ring-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
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
        </header>
        <div className="flex flex-1 flex-col gap-5 p-4 pt-5 pb-24 md:p-6 md:pt-6 md:pb-6">
          <CurrentPage />
        </div>

        <MobileBottomNav />
      </main>
    </div>
  )
}
