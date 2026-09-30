"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Adds/removes the `dark` class on <html> (matching the `dark` variant in globals.css), remembers
// the choice in localStorage, and follows the OS setting until the user picks one.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
