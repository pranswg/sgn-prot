import {
  LayoutDashboard,
  Users,
  GraduationCap,
  CalendarPlus,
  History,
  Settings,
  Music4,
  Church,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { useNavStore, type Page } from '@/store/navStore'
import { cn } from '@/lib/utils'

const NAV_ITEMS: { label: string; page: Page; icon: typeof LayoutDashboard }[] = [
  { label: 'Dashboard', page: 'dashboard', icon: LayoutDashboard },
  { label: 'Master List', page: 'master-list', icon: Users },
  { label: 'Trainees', page: 'trainees', icon: GraduationCap },
  { label: 'Suguan Builder', page: 'suguan-builder', icon: CalendarPlus },
  { label: 'Suguan History', page: 'suguan-history', icon: History },
  { label: 'Settings', page: 'settings', icon: Settings },
]

const NAV_GROUPS: { label: string; items: typeof NAV_ITEMS }[] = [
  { label: 'Overview', items: [NAV_ITEMS[0]] },
  { label: 'Choir Management', items: [NAV_ITEMS[1], NAV_ITEMS[2]] },
  { label: 'Suguan', items: [NAV_ITEMS[3], NAV_ITEMS[4]] },
  { label: 'System', items: [NAV_ITEMS[5]] },
]

export function AppSidebar() {
  const page = useNavStore((s) => s.page)
  const navigate = useNavStore((s) => s.navigate)

  return (
    <Sidebar>
      <SidebarHeader className="p-3 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/15 ring-1 ring-inset ring-sidebar-primary/30">
            <Music4 className="size-4.5 text-sidebar-primary" />
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[0.9375rem] font-semibold tracking-tight text-sidebar-foreground">
              INC Choir Manager
            </span>
            <span className="truncate text-[0.6875rem] tracking-wide text-sidebar-foreground/60">
              Suguan Scheduling System
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator className="mx-3 w-auto bg-sidebar-border" />

      <SidebarContent className="px-3 pt-4">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label} className="p-0">
            <div className="pb-1.5 pl-10 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/40 transition-opacity group-data-[collapsible=icon]:hidden">
              {group.label}
            </div>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {group.items.map((item) => {
                  const isActive =
                    page === item.page ||
                    (item.page === 'suguan-history' && page === 'suguan-detail')
                  return (
                    <SidebarMenuItem key={item.page}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => navigate(item.page)}
                        tooltip={item.label}
                        size="lg"
                        className={cn(
                          'group relative h-10 gap-3 rounded-lg px-2.5 text-[0.8125rem] font-medium text-sidebar-foreground/70 transition-colors',
                          'hover:bg-white/5 hover:text-sidebar-foreground',
                          isActive &&
                            'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent',
                        )}
                      >
                        <item.icon
                          className={cn(
                            'size-4.5 transition-colors',
                            isActive
                              ? 'text-sidebar-primary'
                              : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80',
                          )}
                        />
                        <span>{item.label}</span>
                        {isActive && (
                          <span
                            aria-hidden
                            className="absolute inset-y-1.5 -left-3 w-[3px] rounded-r-full bg-sidebar-primary"
                          />
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="staff-lines relative overflow-hidden rounded-lg bg-white/[0.04] p-3 ring-1 ring-inset ring-sidebar-border">
          <Music4
            aria-hidden
            className="pointer-events-none absolute -right-3 -bottom-3 size-16 text-sidebar-primary/10"
          />
          <div className="relative flex items-start gap-2.5">
            <Church className="mt-0.5 size-4 shrink-0 text-sidebar-primary/80" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[0.8125rem] font-medium text-sidebar-foreground">
                Sta. Monica
              </p>
              <p className="truncate text-[0.6875rem] text-sidebar-foreground/55">
                Iglesia Ni Cristo Choir
              </p>
            </div>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
