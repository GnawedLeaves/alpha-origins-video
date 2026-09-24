"use client";

export function VideoPreviewPlayer({
  src,
  label,
}: {
  src: string | null;
  label?: string;
}) {
  if (!src) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted text-sm text-muted-foreground">
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
        className="aspect-video w-full rounded-xl bg-black"
      />
      {label && <p className="mt-1 text-xs text-muted-foreground">{label}</p>}
    </div>
  );
}
