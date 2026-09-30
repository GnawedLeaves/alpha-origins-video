import { cn } from "@/lib/utils";

// Yellow square with a hand-drawn "ao" monogram, followed by the wordmark. The strokes are
// deliberately a little uneven, like a marker sketch.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={cn("size-9 shrink-0 rounded-md", className)}
    >
      <rect width="40" height="40" rx="6" className="fill-highlighter-yellow" />
      <g
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-forest-ink"
      >
        <path d="M18.4 19.6c-1.3-2.4-4.7-3-6.9-1.3-2.5 1.9-2.8 6.2-.6 8.2 2 1.8 5.3 1.3 6.9-1" />
        <path d="M18.7 17.4c.4 3.5.1 6.9.6 10.3" />
        <path d="M27.9 17.3c-3.1 0-5.2 3-4.7 6.1.5 3 3.6 4.9 6.3 3.7 2.6-1.2 3.5-4.7 2.2-7.2-.8-1.6-2.3-2.7-3.8-2.6z" />
      </g>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-lg font-bold tracking-tight text-foreground">Alpha Origins</span>
    </span>
  );
}
