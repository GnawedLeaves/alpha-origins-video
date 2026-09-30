import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, Roboto_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

// Display headlines only (40px and up).
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: "800",
});

// Everything functional: body, labels, buttons.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Micro-labels and technical metadata.
const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Keemu",
  description: "Make dog video ads for Alpha Origins in a few clicks.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the `dark` class on <html> before hydration, so React would otherwise
    // warn about the attribute mismatch.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bricolage.variable} ${inter.variable} ${robotoMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
