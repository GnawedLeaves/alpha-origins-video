"use client";

import { useEffect, useState } from "react";
import { Ban, CheckCircle2, Loader2, Play, Plus, RotateCw, Trash2, XCircle } from "lucide-react";
import { isCancelled, type Generation } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExpandableText } from "@/components/common/ExpandableText";
import { ClipViewer } from "./ClipViewer";

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

// After this long, a still-running video gets a "taking longer than usual" note.
const SLOW_AFTER_MS = 15 * 60 * 1000;

export function GenerationList({
  generations,
  onAddToTimeline,
  clipSourceIds,
  checkErrors,
  onRetryCheck,
  onCancel,
  onRemove,
}: {
  generations: Generation[];
  onAddToTimeline: (generation: Generation) => void;
  clipSourceIds: Set<string>;
  // Generation id -> why checking on it keeps failing (polling is paused for these).
  checkErrors: Record<string, string>;
  onRetryCheck: (id: string) => void;
  onCancel: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [viewing, setViewing] = useState<Generation | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);
  // Ticks every 30s so "taking longer than usual" appears without a reload.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  async function run(id: string, action: (id: string) => Promise<void>) {
    setActionError(null);
    setBusyId(id);
    try {
      await action(id);
    } catch (err) {
      setActionError({ id, message: (err as Error).message });
    } finally {
      setBusyId(null);
    }
  }

  function confirmCancel(gen: Generation) {
    const ok = window.confirm(
      "Stop making this video?\n\nIf it has already started, fal.ai may still finish it and charge for it, but it won't be shown here."
    );
    if (ok) run(gen.id, onCancel);
  }

  function confirmRemove(gen: Generation) {
    if (window.confirm("Remove this from the list?")) run(gen.id, onRemove);
  }

  if (generations.length === 0) {
    return (
      <p className="mt-8 text-center text-base text-muted-foreground">
        Your clips will appear here. Describe a video above and press &ldquo;Make video&rdquo;.
      </p>
    );
  }

  return (
    <>
      {viewing && (
        <ClipViewer
          generation={viewing}
          added={clipSourceIds.has(viewing.id)}
          onAdd={() => onAddToTimeline(viewing)}
          onClose={() => setViewing(null)}
        />
      )}
      <ul className="mt-4 space-y-3">
        {generations.map((gen) => {
          const pending = gen.status === "queued" || gen.status === "processing";
          const cancelled = isCancelled(gen);
          const checkError = checkErrors[gen.id];
          const slow = pending && !checkError && now - new Date(gen.created_at).getTime() > SLOW_AFTER_MS;
          const busy = busyId === gen.id;

          return (
            <li
              key={gen.id}
              className="flex flex-wrap items-start gap-4 rounded-xl border border-border bg-card p-4 sm:flex-nowrap"
            >
              {gen.status === "completed" && gen.video_url ? (
                <button
                  type="button"
                  onClick={() => setViewing(gen)}
                  aria-label="Watch this clip"
                  title="Watch this clip"
                  className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-black"
                >
                  {/* #t=0.1 makes browsers (Safari especially) show the first frame as a thumbnail. */}
                  <video
                    src={`${gen.video_url}#t=0.1`}
                    preload="metadata"
                    muted
                    playsInline
                    className="pointer-events-none h-full w-full object-cover"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/40">
                    <span className="flex size-9 items-center justify-center rounded-full bg-parchment/90 text-ink">
                      <Play className="size-5 translate-x-px fill-current" />
                    </span>
                  </span>
                </button>
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {cancelled ? (
                    <Ban size={16} className="text-muted-foreground" />
                  ) : checkError ? (
                    <XCircle size={16} className="text-destructive" />
                  ) : (
                    STATUS_ICON[gen.status]
                  )}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <ExpandableText text={gen.prompt} className="text-foreground" />
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge
                    variant={(gen.status === "failed" && !cancelled) || checkError ? "destructive" : "secondary"}
                    className="h-auto py-1 text-sm whitespace-normal"
                  >
                    {cancelled ? "Cancelled" : checkError ? "Couldn't check" : STATUS_TEXT[gen.status]}
                  </Badge>
                  <span>{gen.duration_seconds} seconds</span>
                </div>

                {checkError && (
                  <div className="mt-2 rounded-lg bg-destructive/10 p-3 text-sm">
                    <p className="font-medium text-destructive">
                      We couldn&apos;t check on this video.
                    </p>
                    <p className="mt-0.5 text-foreground">{checkError}</p>
                    <p className="mt-1 text-muted-foreground">
                      It may still be being made. Try again in a moment, or cancel it.
                    </p>
                  </div>
                )}
                {slow && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    This is taking much longer than usual. You can keep waiting or cancel it.
                  </p>
                )}
                {gen.error && !cancelled && (
                  <details className="mt-1 text-sm text-muted-foreground">
                    <summary className="cursor-pointer">What went wrong?</summary>
                    <p className="mt-1 text-destructive">{gen.error}</p>
                  </details>
                )}
                {actionError?.id === gen.id && (
                  <p className="mt-2 text-sm text-destructive">{actionError.message}</p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {gen.status === "completed" && gen.video_url && (
                  <Button
                    variant="outline"
                    onClick={() => onAddToTimeline(gen)}
                    disabled={clipSourceIds.has(gen.id)}
                    className="h-11 px-4"
                  >
                    <Plus /> {clipSourceIds.has(gen.id) ? "Added" : "Use this clip"}
                  </Button>
                )}
                {checkError && (
                  <Button onClick={() => onRetryCheck(gen.id)} disabled={busy} className="h-11 px-4">
                    <RotateCw /> Try again
                  </Button>
                )}
                {pending && (
                  <Button
                    variant="outline"
                    onClick={() => confirmCancel(gen)}
                    disabled={busy}
                    className="h-11 px-4"
                  >
                    {busy ? <Loader2 className="animate-spin" /> : <Ban />} Cancel
                  </Button>
                )}
                {gen.status === "failed" && (
                  <Button
                    variant="ghost"
                    onClick={() => confirmRemove(gen)}
                    disabled={busy}
                    className="h-11 px-3 hover:bg-destructive/10 hover:text-destructive"
                  >
                    {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Remove
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
