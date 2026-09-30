"use client";

import { CheckCircle2, Loader2, XCircle, Plus } from "lucide-react";
import type { Generation } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_TEXT: Record<Generation["status"], string> = {
  queued: "Waiting to start…",
  processing: "Making your video… (usually 2–5 minutes)",
  completed: "Ready",
  failed: "Didn't work — try again",
};

const STATUS_ICON: Record<Generation["status"], React.ReactNode> = {
  queued: <Loader2 size={16} className="animate-spin text-muted-foreground" />,
  processing: <Loader2 size={16} className="animate-spin text-primary" />,
  completed: <CheckCircle2 size={16} className="text-primary" />,
  failed: <XCircle size={16} className="text-destructive" />,
};

export function GenerationList({
  generations,
  onAddToTimeline,
  clipSourceIds,
}: {
  generations: Generation[];
  onAddToTimeline: (generation: Generation) => void;
  clipSourceIds: Set<string>;
}) {
  if (generations.length === 0) {
    return (
      <p className="mt-8 text-center text-body-sm text-muted-foreground">
        Your clips will appear here. Describe a video above and press &ldquo;Make video&rdquo;.
      </p>
    );
  }

  return (
    <ul className="mt-4 space-y-3">
      {generations.map((gen) => (
        <li
          key={gen.id}
          className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4 sm:flex-nowrap"
        >
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
            {gen.status === "completed" && gen.video_url ? (
              <video src={gen.video_url} className="h-full w-full object-cover" muted />
            ) : (
              STATUS_ICON[gen.status]
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-foreground">{gen.prompt}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge
                variant={gen.status === "failed" ? "destructive" : "secondary"}
                className="h-auto py-1 text-sm whitespace-normal"
              >
                {STATUS_TEXT[gen.status]}
              </Badge>
              <span>{gen.duration_seconds} seconds</span>
            </div>
            {gen.error && (
              <details className="mt-1 text-sm text-muted-foreground">
                <summary className="cursor-pointer">What went wrong?</summary>
                <p className="mt-1 text-destructive">{gen.error}</p>
              </details>
            )}
          </div>

          {gen.status === "completed" && gen.video_url && (
            <Button
              variant="outline"
              onClick={() => onAddToTimeline(gen)}
              disabled={clipSourceIds.has(gen.id)}
              className="h-11 shrink-0 px-4"
            >
              <Plus /> {clipSourceIds.has(gen.id) ? "Added" : "Use this clip"}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
