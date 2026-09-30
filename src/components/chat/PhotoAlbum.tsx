"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deleteFromAlbum, listAlbum, uploadToAlbum, type AlbumPhoto } from "@/lib/album";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// "My photos": every photo uploaded is kept here, so it can be reused for future videos without
// uploading it again. Tapping toggles a photo; the order photos are picked in is their @Image
// number for multi-photo models.
export function PhotoAlbum({
  selectedPaths,
  onToggle,
  maxSelected,
  onClose,
  disabled,
}: {
  selectedPaths: string[];
  onToggle: (photo: AlbumPhoto) => void;
  maxSelected: number;
  onClose: () => void;
  disabled?: boolean;
}) {
  const [supabase] = useState(() => createClient());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<AlbumPhoto[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Please sign in again.");
        const list = await listAlbum(supabase, user.id);
        if (cancelled) return;
        setUserId(user.id);
        setPhotos(list);
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
          setPhotos([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !userId) return;
    setError(null);
    setUploading(true);
    try {
      const added: AlbumPhoto[] = [];
      for (const file of files) added.push(await uploadToAlbum(supabase, userId, file));
      setPhotos((prev) => [...[...added].reverse(), ...(prev ?? [])]);
      // Uploading a photo usually means "use this one": pick the new ones, up to the limit.
      added.slice(0, Math.max(0, maxSelected - selectedPaths.length)).forEach(onToggle);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(photo: AlbumPhoto) {
    if (!window.confirm("Remove this photo from your album? Videos already made with it are kept.")) {
      return;
    }
    setError(null);
    setDeletingPath(photo.path);
    try {
      await deleteFromAlbum(supabase, photo.path);
      setPhotos((prev) => (prev ?? []).filter((p) => p.path !== photo.path));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingPath(null);
    }
  }

  const busy = disabled || uploading;

  return (
    <div className="rounded-xl border border-border bg-secondary/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-lg font-medium">My photos</p>
          <p className="text-muted-foreground">
            Tap the photos to use (up to {maxSelected}), tap again to unpick. Photos you upload are
            saved here for next time.
          </p>
        </div>
        <Button onClick={onClose} className="h-11 px-5 text-base">
          <Check /> Done{selectedPaths.length > 0 ? ` (${selectedPaths.length})` : ""}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        // JPG/PNG/WebP only: iPhones convert HEIC photos to JPG when HEIC isn't accepted.
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy || !userId}
          className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input bg-background p-3 text-center font-medium transition-colors hover:bg-accent disabled:opacity-50"
        >
          {uploading ? <Loader2 className="size-7 animate-spin" /> : <Upload className="size-7" />}
          {uploading ? "Saving…" : "Upload a new photo"}
        </button>

        {photos === null &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />
          ))}

        {photos?.map((photo) => {
          const order = selectedPaths.indexOf(photo.path);
          const selected = order !== -1;
          const full = !selected && selectedPaths.length >= maxSelected;
          return (
            <div key={photo.path} className="group relative">
              <button
                type="button"
                onClick={() => onToggle(photo)}
                disabled={busy || full || deletingPath === photo.path}
                aria-pressed={selected}
                aria-label={selected ? `Photo ${order + 1}, tap to unpick` : "Use this photo"}
                title={full ? `You can use up to ${maxSelected} photos` : undefined}
                className={cn(
                  "block aspect-square w-full overflow-hidden rounded-lg bg-muted ring-offset-2 ring-offset-background transition disabled:opacity-50",
                  selected ? "ring-4 ring-selected" : "ring-1 ring-border hover:ring-2 hover:ring-foreground/40"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
              {selected && (
                <span className="pointer-events-none absolute top-2 left-2 flex size-8 items-center justify-center rounded-full bg-selected text-base font-medium text-selected-foreground">
                  {maxSelected > 1 ? order + 1 : <Check className="size-5" />}
                </span>
              )}
              <Button
                variant="secondary"
                size="icon-sm"
                onClick={() => handleDelete(photo)}
                disabled={busy || deletingPath === photo.path}
                aria-label="Remove from album"
                title="Remove from album"
                className="absolute top-2 right-2 bg-background/90 hover:bg-background"
              >
                {deletingPath === photo.path ? <Loader2 className="animate-spin" /> : <Trash2 />}
              </Button>
            </div>
          );
        })}
      </div>

      {photos?.length === 0 && !error && (
        <p className="mt-3 text-muted-foreground">
          No photos yet. Upload a photo of your dog or the food bag to bring it to life.
        </p>
      )}
      {error && <p className="mt-3 text-destructive">{error}</p>}
    </div>
  );
}
