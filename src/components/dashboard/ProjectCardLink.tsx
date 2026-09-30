"use client";

import Link, { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

// Link to a project that shows "Opening…" over the card the moment it's clicked, until the
// project page (or its loading skeleton) takes over.
export function ProjectCardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="relative block h-full rounded-xl">
      {children}
      <PendingOverlay />
    </Link>
  );
}

function PendingOverlay() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-background/90 font-medium text-foreground backdrop-blur-sm">
      <Loader2 className="size-5 animate-spin" /> Opening…
    </span>
  );
}
