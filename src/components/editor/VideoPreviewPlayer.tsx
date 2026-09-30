"use client";

import type { AspectRatio } from "@/lib/types/domain";

const PLACEHOLDER_ASPECT: Record<AspectRatio, string> = {
  "16:9": "aspect-video w-full",
  // Size tall frames from the height so they keep their shape inside a wide column.
  "9:16": "aspect-[9/16] h-[min(60vh,520px)] max-w-full",
  "1:1": "aspect-square h-[min(60vh,520px)] max-w-full",
};

export function VideoPreviewPlayer({
  src,
  label,
  aspectRatio = "16:9",
}: {
  src: string | null;
  label?: string;
  aspectRatio?: AspectRatio;
}) {
  if (!src) {
    return (
      <div
        className={`mx-auto flex items-center justify-center rounded-xl border border-dashed border-border bg-muted text-sm text-muted-foreground ${PLACEHOLDER_ASPECT[aspectRatio]}`}
      >
        Nothing to preview yet
      </div>
    );
  }

  return (
    <div className="w-full">
      <video
        key={src}
        src={src}
        controls
        className="max-h-[70vh] w-full rounded-xl bg-black object-contain"
      />
      {label && <p className="mt-1 text-xs text-muted-foreground">{label}</p>}
    </div>
  );
}
