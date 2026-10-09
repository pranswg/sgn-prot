import { QueryClient } from '@tanstack/react-query'

/**
 * Shared React Query client for all server-state in the app.
 *
 * `staleTime` gives a short window where remounting a page reuses the last
 * fetch instead of hitting Supabase again; mutations invalidate explicitly.
 * Window-focus refetching is off because this is an internal admin tool, not a
 * feed, and the extra chatter is noise.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
