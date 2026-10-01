import { Toaster } from '@/components/ui/sonner'
import { Layout } from '@/app/Layout'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthPage } from '@/features/auth/AuthPage'
import { useAuthStore } from '@/store/authStore'
import { ThemeProvider } from '@/components/sidebar/ThemeProvider'

function App() {
  // Reading the id rather than the account object keeps this component from
  // re-rendering when an unrelated field of the signed-in account changes.
  const currentAccountId = useAuthStore((s) => s.currentAccountId)

  // The auth screen replaces the whole shell rather than rendering inside it,
  // so an unauthenticated visitor never sees the sidebar or page chrome.
  // `navStore` is not persisted, so a reload after signing in lands on the
  // dashboard rather than a page from the previous session.
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={0}>
        {currentAccountId ? <Layout /> : <AuthPage />}
        <Toaster richColors position="top-center" />
      </TooltipProvider>
    </ThemeProvider>
  )
}

export default App