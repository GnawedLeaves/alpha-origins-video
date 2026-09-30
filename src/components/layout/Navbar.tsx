"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function Navbar({ email }: { email?: string }) {
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="px-4 pt-4">
      {/* Floating pill nav with a soft yellow glow bleeding below it. */}
      <div className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-input bg-background px-3 py-2 shadow-glow dark:border-border dark:shadow-none">
        <Link href="/dashboard" aria-label="Keemu — your projects">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          {email && (
            <span className="hidden font-mono text-micro text-muted-foreground sm:inline">
              {email}
            </span>
          )}
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
