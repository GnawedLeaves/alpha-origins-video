"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Adds/removes the `dark` class on <html> (matching the `dark` variant in globals.css) and
// remembers the choice in localStorage. Starts on the light cream theme regardless of the OS setting.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
