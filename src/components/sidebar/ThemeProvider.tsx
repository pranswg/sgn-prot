import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'

/**
 * One theme provider for the whole app. It is wrapped rather than inlined so
 * the three decisions that the design spec fixes live in exactly one place:
 *
 * - `attribute="class"` toggles `.dark` on <html>, which is what
 *   `@custom-variant dark (&:where(.dark, .dark *))` in `index.css` matches.
 * - `defaultTheme="system"` is what makes the first load follow the OS. The
 *   user's explicit choice, once made, is stored and wins from then on.
 * - `storageKey="choir-theme"` matches the `choir-` prefix the app's own
 *   stores use; next-themes would otherwise claim the bare `theme` key.
 *
 * `next-themes` was already a dependency and `ui/sonner.tsx` already called
 * `useTheme()`, but nothing ever mounted a provider, so that call was reading
 * a default-constructed context. This is what makes the theme toggle real.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      storageKey="choir-theme"
      enableSystem
    >
      {children}
    </NextThemesProvider>
  )
}