import {
  LayoutDashboard,
  Users,
  GraduationCap,
  CalendarPlus,
  History,
  Settings,
  Music,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
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

export function AppSidebar() {
  const page = useNavStore((s) => s.page)
  const navigate = useNavStore((s) => s.navigate)

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Music className="size-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">INC Choir Manager</span>
            <span className="text-xs text-muted-foreground">
              Suguan Scheduling System
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = page === item.page || (item.page === 'suguan-history' && page === 'suguan-detail')
                return (
                  <SidebarMenuItem key={item.page}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => navigate(item.page)}
                      tooltip={item.label}
                      className={cn(isActive && 'bg-sidebar-accent text-sidebar-accent-foreground')}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-4 py-2 text-xs text-muted-foreground">
          Prototype v1 — LocalStorage
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}