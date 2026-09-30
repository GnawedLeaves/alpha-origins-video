"use client";

import { useIsClient } from "./useIsClient";

// A date/time in the viewer's own time zone (the server doesn't know it).
export function LocalDateTime({ iso }: { iso: string }) {
  const isClient = useIsClient();
  if (!isClient) return <span className="inline-block h-4 w-28 animate-pulse rounded bg-muted" />;
  const d = new Date(iso);
  return (
    <time dateTime={iso} className="whitespace-nowrap">
      {d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
      <span className="text-muted-foreground">
        {" · "}
        {d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
      </span>
    </time>
  );
}
