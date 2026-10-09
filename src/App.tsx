import { useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { Layout } from '@/app/Layout'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthPage } from '@/features/auth/AuthPage'
import { PasswordChangePage } from '@/features/auth/PasswordChangePage'
import { useAuthStore } from '@/store/authStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { WorkspaceSyncToast } from '@/components/WorkspaceSyncToast'
import { ThemeProvider } from '@/components/sidebar/ThemeProvider'

function App() {
  // Reading the id rather than the account object keeps this component from
  // re-rendering when an unrelated field of the signed-in account changes.
  const ready = useAuthStore((s) => s.ready)
  const currentAccountId = useAuthStore((s) => s.currentAccountId)
  const workspaceReady = useWorkspaceStore((s) => s.ready)
  const mustChangePassword = useAuthStore((s) =>
    s.accounts.find((account) => account.id === s.currentAccountId)?.mustChangePassword
      ?? false,
  )

  // Restore the Supabase session on boot and subscribe to sign-out, then make
  // sure a known Admin login exists (server-side, idempotent). `seedDefaultAdmin`
  // never signs anyone in.
  useEffect(() => {
    void useAuthStore.getState().bootstrap()
    void useAuthStore.getState().seedDefaultAdmin()
  }, [])

  // Load the shared workspace once someone is signed in and past the forced
  // password change (the server blocks workspace access until then, so hydrating
  // earlier would only read empty). Tear the mirror down otherwise.
  useEffect(() => {
    if (currentAccountId && !mustChangePassword) {
      void useWorkspaceStore.getState().hydrate()
    } else {
      useWorkspaceStore.getState().reset()
    }
  }, [currentAccountId, mustChangePassword])

  // The auth screen replaces the whole shell rather than rendering inside it,
  // so an unauthenticated visitor never sees the sidebar or page chrome.
  // `navStore` restores where the user was on a same-tab reload, but opening the
  // app again (or signing in) always lands on the dashboard.
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={0}>
        {!ready
          ? <div className="min-h-dvh bg-muted/40" aria-busy="true" />
          : currentAccountId
            ? mustChangePassword
              ? <PasswordChangePage />
              : workspaceReady
                ? <Layout />
                : <div className="min-h-dvh bg-muted/40" aria-busy="true" />
            : <AuthPage />}
        <Toaster richColors position="top-center" />
        <WorkspaceSyncToast />
      </TooltipProvider>
    </ThemeProvider>
  )
}

export default App