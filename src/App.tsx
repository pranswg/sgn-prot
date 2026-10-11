import { useEffect, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { Layout } from '@/app/Layout'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { AuthPage } from '@/features/auth/AuthPage'
import { PasswordChangePage } from '@/features/auth/PasswordChangePage'
import { useAuthStore } from '@/store/authStore'
import { useAdminStore } from '@/store/adminStore'
import { useServerDataStore } from '@/store/serverDataStore'
import { setWriteNotifier } from '@/lib/writeThrough'
import { ThemeProvider } from '@/components/sidebar/ThemeProvider'

// Stores report a failed server write through this notifier instead of importing
// `sonner` themselves, which keeps the store graph (and the node test runner)
// free of React. Registered once, before any store action can run.
setWriteNotifier((message) => toast.error(message))

function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

/**
 * Holds the shell until the Phase 3 server read has settled, so a signed-in
 * reload never flashes empty pages. On error the local cache is left intact and
 * the user gets a retry (plus a way out via sign-out, since the shell is not
 * mounted yet).
 */
function ServerDataGate({ children }: { children: ReactNode }) {
  const status = useServerDataStore((state) => state.status)
  const error = useServerDataStore((state) => state.error)
  const load = useServerDataStore((state) => state.load)
  const signOut = useAuthStore((state) => state.signOut)

  if (status === 'error') {
    return (
      <CenteredMessage>
        <div className="flex max-w-sm flex-col items-center gap-4">
          <p>{error ?? 'Could not load data from the server.'}</p>
          <div className="flex gap-2">
            <Button onClick={() => void load()}>Try again</Button>
            <Button variant="outline" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </CenteredMessage>
    )
  }

  if (status !== 'ready') {
    return <CenteredMessage>Loading…</CenteredMessage>
  }

  return <>{children}</>
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
  const loadServerData = useServerDataStore((s) => s.load)
  const resetServerData = useServerDataStore((s) => s.reset)

  // Restore the persisted Supabase session (and refresh the profile cache) once
  // on load. The store memoises this so StrictMode's double mount is harmless.
  useEffect(() => {
    void useAuthStore.getState().initialize()
  }, [])

  // Fetch the server data once the session is known, and drop it on sign-out so
  // the next sign-in re-reads rather than reusing the previous user's cache.
  // Roles are part of the same read: `usePermissions` stays synchronous off the
  // admin store's cache, which `refreshRoles` fills from `public.roles`.
  useEffect(() => {
    if (currentAccountId) {
      void loadServerData()
      void useAdminStore
        .getState()
        .refreshRoles()
        .catch((cause) => console.error('Could not load roles from the server:', cause))
      // Audit logs and login history are permission-gated reads, so only an
      // Admin can hydrate them; a lesser account would just get an empty result.
      const account = useAuthStore
        .getState()
        .accounts.find((item) => item.id === currentAccountId)
      if (account?.role === 'admin') {
        void useAdminStore
          .getState()
          .refreshSecurity()
          .catch((cause) =>
            console.error('Could not load the audit trail from the server:', cause),
          )
      }
    } else {
      resetServerData()
    }
  }, [currentAccountId, loadServerData, resetServerData])

  // Hold the auth screen until the session has been restored, so a reload with
  // a valid session never flashes the sign-in form.
  const content =
    initializing && !currentAccountId ? (
      <CenteredMessage>Loading…</CenteredMessage>
    ) : currentAccountId ? (
      mustChangePassword ? (
        <PasswordChangePage />
      ) : (
        <ServerDataGate>
          <Layout />
        </ServerDataGate>
      )
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
