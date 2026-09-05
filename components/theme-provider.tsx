'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

/**
 * Keeps a visitor's theme choice in local storage, while using their operating
 * system preference until they make one. The class is applied to <html>, which
 * is where the global colour tokens expect it.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  )
}
