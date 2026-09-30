"use client";

import Link, { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// A link styled as a button whose icon turns into a spinner while the next page loads.
export function LinkButton({
  href,
  icon,
  variant = "outline",
  className,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant }), className)}>
      <PendingIcon icon={icon} />
      {children}
    </Link>
  );
}

function PendingIcon({ icon }: { icon: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className="animate-spin" aria-label="Loading" /> : <>{icon}</>;
}
