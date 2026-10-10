import { useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { Layout } from '@/app/Layout'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthPage } from '@/features/auth/AuthPage'
import { PasswordChangePage } from '@/features/auth/PasswordChangePage'
import { useAuthStore } from '@/store/authStore'
import { ThemeProvider } from '@/components/sidebar/ThemeProvider'

function AuthLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 text-sm text-muted-foreground">
      Loading…
    </div>
  )
}

function App() {
  // Reading the id rather than the account object keeps this component from
  // re-rendering when an unrelated field of the signed-in account changes.
  const currentAccountId = useAuthStore((s) => s.currentAccountId)
  const initializing = useAuthStore((s) => s.initializing)
  const mustChangePassword = useAuthStore((s) =>
    s.accounts.find((account) => account.id === s.currentAccountId)?.mustChangePassword
      ?? false,
  )

  // Restore the persisted Supabase session (and refresh the profile cache) once
  // on load. The store memoises this so StrictMode's double mount is harmless.
  useEffect(() => {
    void useAuthStore.getState().initialize()
  }, [])

  // Hold the auth screen until the session has been restored, so a reload with
  // a valid session never flashes the sign-in form.
  const content =
    initializing && !currentAccountId ? (
      <AuthLoading />
    ) : currentAccountId ? (
      mustChangePassword ? <PasswordChangePage /> : <Layout />
    ) : (
      <AuthPage />
    )

  // The auth screen replaces the whole shell rather than rendering inside it,
  // so an unauthenticated visitor never sees the sidebar or page chrome.
  // `navStore` is persisted, so a reload returns the signed-in user to the page
  // they were on rather than the dashboard.
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={0}>
        {content}
        <Toaster richColors position="top-center" />
      </TooltipProvider>
    </ThemeProvider>
  )
}

export default App
