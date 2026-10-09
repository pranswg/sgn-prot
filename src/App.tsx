import { useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { Layout } from '@/app/Layout'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthPage } from '@/features/auth/AuthPage'
import { PasswordChangePage } from '@/features/auth/PasswordChangePage'
import { useAuthStore } from '@/store/authStore'
import { ThemeProvider } from '@/components/sidebar/ThemeProvider'

function App() {
  // Reading the id rather than the account object keeps this component from
  // re-rendering when an unrelated field of the signed-in account changes.
  const currentAccountId = useAuthStore((s) => s.currentAccountId)
  const mustChangePassword = useAuthStore((s) =>
    s.accounts.find((account) => account.id === s.currentAccountId)?.mustChangePassword
      ?? false,
  )

  // Guarantee a known Admin login on a fresh browser (or one whose admins were
  // all disabled). Idempotent: a store that already has an active Admin is
  // untouched. Never signs the visitor in.
  useEffect(() => {
    void useAuthStore.getState().seedDefaultAdmin()
  }, [])

  // The auth screen replaces the whole shell rather than rendering inside it,
  // so an unauthenticated visitor never sees the sidebar or page chrome.
  // `navStore` is persisted, so a reload returns the signed-in user to the page
  // they were on rather than the dashboard.
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={0}>
        {currentAccountId
          ? mustChangePassword
            ? <PasswordChangePage />
            : <Layout />
          : <AuthPage />}
        <Toaster richColors position="top-center" />
      </TooltipProvider>
    </ThemeProvider>
  )
}

export default App