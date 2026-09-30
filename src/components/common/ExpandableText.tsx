"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

// Long text clamped to a few lines, with a "Show full description" toggle. The toggle only
// appears when the text is long enough to be cut off.
export function ExpandableText({
  text,
  lines = 2,
  threshold = 120,
  className,
}: {
  text: string;
  lines?: 2 | 3;
  // Characters above which the text is treated as "long".
  threshold?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > threshold;

  return (
    <div className={className}>
      <p
        className={cn(
          "whitespace-pre-line break-words",
          long && !expanded && (lines === 3 ? "line-clamp-3" : "line-clamp-2")
        )}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          {expanded ? "Show less" : "Show full description"}
        </button>
      )}
    </div>
  );
}
