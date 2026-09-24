"use client";

import { CheckCircle2, Loader2, XCircle, Plus } from "lucide-react";
import type { Generation } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_ICON: Record<Generation["status"], React.ReactNode> = {
  queued: <Loader2 size={16} className="animate-spin text-muted-foreground" />,
  processing: <Loader2 size={16} className="animate-spin text-primary" />,
  completed: <CheckCircle2 size={16} className="text-green-600" />,
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
      <p className="mt-6 text-center text-sm text-muted-foreground">
        No generations yet — describe an ad above and hit Generate.
      </p>
    );
  }

  return (
    <ul className="mt-4 space-y-3">
      {generations.map((gen) => (
        <li
          key={gen.id}
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm"
        >
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
            {gen.status === "completed" && gen.video_url ? (
              <video src={gen.video_url} className="h-full w-full object-cover" muted />
            ) : (
              STATUS_ICON[gen.status]
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-foreground">{gen.prompt}</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {gen.model} · {gen.duration_seconds}s
              </span>
              <Badge variant={gen.status === "failed" ? "destructive" : "secondary"}>
                {gen.status}
              </Badge>
            </div>
            {gen.error && <p className="mt-0.5 text-xs text-destructive">{gen.error}</p>}
          </div>

          {gen.status === "completed" && gen.video_url && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddToTimeline(gen)}
              disabled={clipSourceIds.has(gen.id)}
            >
              <Plus size={12} /> {clipSourceIds.has(gen.id) ? "Added" : "Add to timeline"}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
