import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/AppSidebar'
import { Separator } from '@/components/ui/separator'
import { useNavStore } from '@/store/navStore'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { MasterListPage } from '@/features/master-list/MasterListPage'
import { TraineePage } from '@/features/trainees/TraineePage'
import { SuguanBuilderPage } from '@/features/suguan-builder/SuguanBuilderPage'
import { SuguanHistoryPage } from '@/features/suguan-history/SuguanHistoryPage'
import { SuguanDetailPage } from '@/features/suguan-history/SuguanDetailPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

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

export function Layout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <div className="text-sm font-medium">
            INC Choir Management & Suguan Scheduling System
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 md:p-6 md:pt-2">
          <CurrentPage />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}