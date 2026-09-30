"use client";

import { useRef, useState } from "react";
import { ArrowRight, Copy, Download, Loader2, Pause, Play, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ClipTrimmer, type EditorClip } from "./ClipTrimmer";
import { VideoPreviewPlayer } from "./VideoPreviewPlayer";
import { TimelineTracks, type TimelineSelection } from "./TimelineTracks";
import { MusicPanel } from "./MusicPanel";
import { useTimelinePlayback } from "./useTimelinePlayback";
import type { MusicTrack } from "./timeline-model";
import { downloadFile } from "@/lib/media";
import { useFfmpeg, type FitMode } from "./useFfmpeg";
import { ASPECT_RATIO_LABELS, type AspectRatio, type ExportRecord } from "@/lib/types/domain";
import { orientationOf } from "@/lib/utils/video";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ASPECT_RATIOS = Object.keys(ASPECT_RATIO_LABELS) as AspectRatio[];

const PREVIEW_FRAME: Record<AspectRatio, string> = {
  "9:16": "aspect-[9/16] h-[min(55vh,480px)]",
  "1:1": "aspect-square h-[min(55vh,480px)]",
  "16:9": "aspect-video w-full",
};

export function Timeline({
  projectId,
  clips,
  setClips,
  music,
  setMusic,
  aspectRatio,
  setAspectRatio,
  fit,
  setFit,
  finishedUrl,
  onExportComplete,
  onContinue,
}: {
  projectId: string;
  clips: EditorClip[];
  setClips: (updater: (prev: EditorClip[]) => EditorClip[]) => void;
  music: MusicTrack | null;
  setMusic: (music: MusicTrack | null) => void;
  aspectRatio: AspectRatio;
  setAspectRatio: (aspectRatio: AspectRatio) => void;
  fit: FitMode;
  setFit: (fit: FitMode) => void;
  // The last rendered video (blob: URL), kept by the parent so it survives switching tabs.
  finishedUrl: string | null;
  onExportComplete: (exportRecord: ExportRecord, previewUrl: string) => void;
  onContinue: () => void;
}) {
  const supabase = createClient();
  const { renderTimeline, loading: ffmpegLoading, progress, stage } = useFfmpeg();
  // Destructured on purpose: the hook returns refs, and reading fields off an object that holds
  // refs during render trips React's refs lint rule.
  const {
    videoRef,
    audioRef,
    onLoadedMetadata,
    time: playTime,
    total: playTotal,
    playing,
    play,
    pause,
    seek,
  } = useTimelinePlayback(clips, music);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<TimelineSelection>(null);

  // Selection pointing at a clip that no longer exists means nothing is selected; with nothing
  // selected, the first clip is shown so there's always something to edit.
  const selectedClipIndex =
    selection?.kind === "clip" ? clips.findIndex((c) => c.id === selection.id) : -1;
  const effectiveSelection: TimelineSelection =
    selection?.kind === "music" && music
      ? selection
      : selectedClipIndex !== -1
        ? selection
        : clips[0]
          ? { kind: "clip", id: clips[0].id }
          : null;
  const selectedIndex =
    effectiveSelection?.kind === "clip" ? clips.findIndex((c) => c.id === effectiveSelection.id) : -1;

  const mismatchedClips = clips.filter(
    (c) => c.width && c.height && orientationOf(c.width, c.height) !== aspectRatio
  ).length;

  function updateTrim(id: string, trimStart: number, trimEnd: number) {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, trimStart, trimEnd } : c)));
  }

  function removeClip(id: string) {
    setClips((prev) => prev.filter((c) => c.id !== id));
  }

  // Splits a clip into two at `at` seconds (the paused playhead); falls back to the midpoint.
  function splitClip(id: string, at?: number) {
    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      const clip = prev[idx];
      const cut =
        at !== undefined && at > clip.trimStart && at < clip.trimEnd
          ? at
          : (clip.trimStart + clip.trimEnd) / 2;
      const first: EditorClip = { ...clip, trimEnd: cut };
      const second: EditorClip = { ...clip, id: crypto.randomUUID(), trimStart: cut };
      return [...prev.slice(0, idx), first, second, ...prev.slice(idx + 1)];
    });
  }

  function duplicateClip(id: string) {
    const copyId = crypto.randomUUID();
    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      return [...prev.slice(0, idx + 1), { ...prev[idx], id: copyId }, ...prev.slice(idx + 1)];
    });
    setSelection({ kind: "clip", id: copyId });
  }

  function reorderClip(from: number, to: number) {
    setClips((prev) => {
      if (from < 0 || from >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
      return next;
    });
  }

  function moveClip(id: string, direction: "up" | "down") {
    const idx = clips.findIndex((c) => c.id === id);
    if (idx !== -1) reorderClip(idx, direction === "up" ? idx - 1 : idx + 1);
  }

  async function handleMusicFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    const url = URL.createObjectURL(file);
    try {
      const duration = await new Promise<number>((resolve, reject) => {
        const audio = new Audio();
        audio.preload = "metadata";
        audio.onloadedmetadata = () => resolve(audio.duration);
        audio.onerror = () => reject(new Error("That file isn't a song this browser can play. Try an MP3."));
        audio.src = url;
      });
      if (music) URL.revokeObjectURL(music.url);
      setMusic({
        url,
        name: file.name,
        duration,
        offset: music?.offset ?? 0,
        trimStart: 0,
        volume: music?.volume ?? 0.8,
        fadeOut: music?.fadeOut ?? true,
      });
      setSelection({ kind: "music" });
    } catch (err) {
      URL.revokeObjectURL(url);
      setError((err as Error).message);
    }
  }

  function removeMusic() {
    if (music) URL.revokeObjectURL(music.url);
    setMusic(null);
    setSelection(null);
  }

  async function handleExport() {
    if (clips.length === 0) return;
    pause();
    setError(null);
    setRendering(true);
    try {
      const blob = await renderTimeline(
        clips.map((c) => ({ id: c.id, sourceUrl: c.sourceUrl, trimStart: c.trimStart, trimEnd: c.trimEnd })),
        { aspectRatio, fit },
        music
      );
      const localUrl = URL.createObjectURL(blob);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again.");

      const path = `${user.id}/${projectId}/${crypto.randomUUID()}.mp4`;
      const { error: uploadError } = await supabase.storage
        .from("exports")
        .upload(path, blob, { contentType: "video/mp4" });
      if (uploadError) throw uploadError;

      const { data: signed, error: signError } = await supabase.storage
        .from("exports")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      if (signError || !signed) throw signError ?? new Error("Failed to sign export URL");

      const res = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          videoUrl: signed.signedUrl,
          durationSeconds: playTotal,
          clipIds: clips.map((c) => c.id).filter((id) => isUuid(id)),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save export");

      onExportComplete(body.export as ExportRecord, localUrl);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRendering(false);
    }
  }

  if (clips.length === 0) {
    return (
      <div className="max-w-xl rounded-xl bg-sticky-note-blush p-6 text-forest-ink">
        <p className="font-semibold">Nothing to put together yet</p>
        <p className="mt-1">
          In step 1, press &ldquo;Use this clip&rdquo; on a finished video. Your clips will appear
          here on a timeline, where you can arrange them and add music.
        </p>
      </div>
    );
  }

  const atEnd = !playing && playTime >= playTotal - 0.05;

  return (
    <div className="space-y-6">
      <input
        ref={musicInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleMusicFile}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Preview */}
        <div>
          <h3 className="text-base font-semibold text-foreground">Preview</h3>
          <div
            className={cn(
              "mx-auto mt-3 max-w-full overflow-hidden rounded-xl bg-black",
              PREVIEW_FRAME[aspectRatio]
            )}
          >
            {/* Muted: clip audio isn't used in the export; sound comes from the music track. */}
            <video
              ref={videoRef}
              muted
              playsInline
              preload="auto"
              onLoadedMetadata={onLoadedMetadata}
              onClick={() => (playing ? pause() : play())}
              className={cn(
                "h-full w-full cursor-pointer",
                fit === "fill" ? "object-cover" : "object-contain"
              )}
            />
          </div>
          {music && <audio ref={audioRef} src={music.url} preload="auto" />}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              onClick={() => (playing ? pause() : play())}
              className="h-11 px-4 text-base"
            >
              {playing ? <Pause /> : atEnd ? <RotateCcw /> : <Play />}
              {playing ? "Pause" : atEnd ? "Watch again" : "Play"}
            </Button>
            {playTime > 0 && !playing && !atEnd && (
              <Button variant="ghost" onClick={() => seek(0)} className="h-11 px-3 text-base">
                <RotateCcw /> To the start
              </Button>
            )}
            <span className="ml-auto font-mono text-sm text-muted-foreground tabular-nums">
              {playTime.toFixed(1)}s / {playTotal.toFixed(1)}s
            </span>
          </div>
        </div>

        {/* Export */}
        <div>
          <h3 className="text-base font-semibold text-foreground">Final video</h3>
          <div className="mt-3 flex flex-wrap items-start gap-4">
            <div className="space-y-1.5">
              <Label>Shape</Label>
              <Select
                value={aspectRatio}
                onValueChange={(v) => v && setAspectRatio(v as AspectRatio)}
                items={ASPECT_RATIO_LABELS}
              >
                <SelectTrigger aria-label="Export format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map((ratio) => (
                    <SelectItem key={ratio} value={ratio}>
                      {ASPECT_RATIO_LABELS[ratio]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>If a clip is a different shape</Label>
              <div className="flex gap-1">
                <Button
                  variant={fit === "fill" ? "secondary" : "ghost"}
                  onClick={() => setFit("fill")}
                  aria-pressed={fit === "fill"}
                >
                  Zoom to fill
                </Button>
                <Button
                  variant={fit === "fit" ? "secondary" : "ghost"}
                  onClick={() => setFit("fit")}
                  aria-pressed={fit === "fit"}
                >
                  Show whole clip
                </Button>
              </div>
            </div>
          </div>
          {mismatchedClips > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              {mismatchedClips} {mismatchedClips === 1 ? "clip doesn't" : "clips don't"} match this
              shape and will be{" "}
              {fit === "fill" ? "zoomed in to fill the frame" : "shown whole, with black bars"}.
            </p>
          )}

          <Button
            onClick={handleExport}
            disabled={rendering}
            className="mt-4 h-12 w-full text-lg"
          >
            {rendering ? <Loader2 className="animate-spin" /> : <Download />}
            {rendering
              ? stage || (ffmpegLoading ? "Loading video engine…" : `Rendering… ${Math.round(progress * 100)}%`)
              : "Make final video"}
          </Button>
          <p className="mt-2 text-sm text-muted-foreground">
            Joins your clips{music ? " and music" : ""} into one video. It can take a minute — keep
            this page open.
          </p>
          {error && <p className="mt-2 text-destructive">{error}</p>}

          {finishedUrl && (
            <div className="mt-6 border-t border-border pt-5">
              <h3 className="text-base font-semibold text-foreground">Your finished video</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Saved. Changed something? Press &ldquo;Make final video&rdquo; again.
              </p>
              <div className="mt-3">
                <VideoPreviewPlayer src={finishedUrl} aspectRatio={aspectRatio} />
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button onClick={onContinue} className="h-11 px-4 text-base">
                  Next: write captions <ArrowRight />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => downloadFile(finishedUrl, "alpha-origins-ad.mp4")}
                  className="h-11 px-4 text-base"
                >
                  <Download /> Download video
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-base font-semibold text-foreground">Timeline</h3>
          <p className="text-sm text-muted-foreground">
            Drag clips to change the order. Tap a clip or the music to change it.
          </p>
        </div>
        <TimelineTracks
          clips={clips}
          music={music}
          time={playTime}
          total={playTotal}
          selection={effectiveSelection}
          onSelect={setSelection}
          onSeek={seek}
          onReorder={reorderClip}
          onMusicOffset={(offset) => music && setMusic({ ...music, offset })}
          onAddMusic={() => musicInputRef.current?.click()}
        />
      </div>

      {/* Editor for the selected item */}
      {effectiveSelection?.kind === "music" && music ? (
        <MusicPanel
          music={music}
          total={playTotal}
          onChange={(patch) => setMusic({ ...music, ...patch })}
          onReplace={() => musicInputRef.current?.click()}
          onRemove={removeMusic}
        />
      ) : selectedIndex !== -1 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto font-semibold">Editing clip {selectedIndex + 1}</p>
            <Button
              variant="outline"
              onClick={() => duplicateClip(clips[selectedIndex].id)}
              className="h-10 px-3 text-base"
            >
              <Copy /> Duplicate clip
            </Button>
          </div>
          <ClipTrimmer
            key={clips[selectedIndex].id}
            clip={clips[selectedIndex]}
            index={selectedIndex}
            total={clips.length}
            onChangeTrim={updateTrim}
            onRemove={removeClip}
            onSplit={splitClip}
            onMove={moveClip}
          />
        </div>
      ) : null}
    </div>
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
