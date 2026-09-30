"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FolderOpen, Loader2, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";

export interface SidebarProject {
  id: string;
  name: string;
}

// Left rail (desktop) / top bar (phones): brand, "Projects", recent projects, account.
// Active items get the teal fill; everything else is quiet graphite text.
export function Sidebar({ email, projects }: { email?: string; projects: SidebarProject[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [signingOut, setSigningOut] = useState(false);
  const [navigating, startNavigation] = useTransition();

  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    startNavigation(() => {
      router.push("/login");
      router.refresh();
    });
  }

  const onDashboard = pathname === "/dashboard";
  const signOutButton = (
    <Button variant="ghost" onClick={signOut} loading={signingOut || navigating} className="h-10 px-3 text-base">
      <LogOut /> Sign out
    </Button>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="px-4 pt-5 pb-4">
          <Link href="/dashboard" aria-label="Keemu — your projects" className="inline-flex rounded-lg">
            <Logo />
          </Link>
        </div>
        <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3">
          <NavItem href="/dashboard" active={onDashboard} icon={<FolderOpen />}>
            Projects
          </NavItem>
          {projects.length > 0 && (
            <>
              <p className="mt-5 mb-1 px-3 text-sm text-muted-foreground">Recent projects</p>
              {projects.map((p) => (
                <NavItem key={p.id} href={`/projects/${p.id}`} active={pathname.startsWith(`/projects/${p.id}`)}>
                  {p.name}
                </NavItem>
              ))}
            </>
          )}
        </nav>
        <div className="space-y-2 border-t border-sidebar-border p-3">
          {email && <p className="truncate px-3 text-sm text-muted-foreground">{email}</p>}
          <div className="flex items-center justify-between">
            {signOutButton}
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-sidebar-border bg-sidebar px-3 py-2 lg:hidden">
        <Link href="/dashboard" aria-label="Keemu — your projects" className="mr-1 rounded-lg">
          <Logo compact />
        </Link>
        <NavItem href="/dashboard" active={onDashboard} icon={<FolderOpen />} compact>
          Projects
        </NavItem>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={signOut} loading={signingOut || navigating} aria-label="Sign out">
            <LogOut />
          </Button>
        </div>
      </header>
    </>
  );
}

function NavItem({
  href,
  active,
  icon,
  compact,
  children,
}: {
  href: string;
  active: boolean;
  icon?: React.ReactNode;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-xl px-3 text-base transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
        compact ? "py-1.5" : "py-2",
        active
          ? "bg-selected text-selected-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
      )}
    >
      <NavIcon icon={icon} />
      <span className="truncate">{children}</span>
    </Link>
  );
}

// The item's icon, or a spinner while its page loads (so a click always visibly "took").
function NavIcon({ icon }: { icon?: React.ReactNode }) {
  const { pending } = useLinkStatus();
  if (pending) return <Loader2 className="animate-spin" aria-label="Loading" />;
  return <>{icon}</>;
}
