"use client";

import { useEffect, useRef } from "react";
import { Download, Plus, X } from "lucide-react";
import type { Generation } from "@/lib/types/domain";
import { downloadFile } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { ExpandableText } from "@/components/common/ExpandableText";

// Full-size player for one finished clip. Uses the native <dialog> so Esc and the backdrop close it
// and focus stays inside while it's open.
export function ClipViewer({
  generation,
  added,
  onAdd,
  onClose,
}: {
  generation: Generation;
  added: boolean;
  onAdd: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        // Clicking the dimmed backdrop (the dialog element itself) closes it.
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto w-[min(56rem,calc(100vw-2rem))] rounded-2xl bg-background p-0 text-foreground shadow-subtle backdrop:bg-black/70"
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <ExpandableText text={generation.prompt} lines={3} threshold={200} className="min-w-0 flex-1 text-foreground" />
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" title="Close">
            <X />
          </Button>
        </div>
        <video
          src={generation.video_url ?? undefined}
          controls
          autoPlay
          playsInline
          className="mt-3 max-h-[70vh] w-full rounded-lg bg-black object-contain"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            onClick={() => {
              onAdd();
              onClose();
            }}
            disabled={added}
            className="h-11 px-4 text-base"
          >
            <Plus /> {added ? "Already added" : "Use this clip"}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              generation.video_url &&
              downloadFile(generation.video_url, `alpha-origins-clip-${generation.id.slice(0, 8)}.mp4`)
            }
            className="h-11 px-4 text-base"
          >
            <Download /> Download clip
          </Button>
        </div>
      </div>
    </dialog>
  );
}
