"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ClipTrimmer, type EditorClip } from "./ClipTrimmer";
import { VideoPreviewPlayer } from "./VideoPreviewPlayer";
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

const ASPECT_RATIOS = Object.keys(ASPECT_RATIO_LABELS) as AspectRatio[];

export function Timeline({
  projectId,
  clips,
  setClips,
  onExportComplete,
}: {
  projectId: string;
  clips: EditorClip[];
  setClips: (updater: (prev: EditorClip[]) => EditorClip[]) => void;
  onExportComplete: (exportRecord: ExportRecord, previewUrl: string) => void;
}) {
  const supabase = createClient();
  const { renderTimeline, loading: ffmpegLoading, progress, stage } = useFfmpeg();
  const [rendering, setRendering] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Vertical by default: Reels, TikTok and Shorts are all 9:16.
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [fit, setFit] = useState<FitMode>("fill");

  const mismatchedClips = clips.filter(
    (c) => c.width && c.height && orientationOf(c.width, c.height) !== aspectRatio
  ).length;

  function updateTrim(id: string, trimStart: number, trimEnd: number) {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, trimStart, trimEnd } : c)));
  }

  function removeClip(id: string) {
    setClips((prev) => prev.filter((c) => c.id !== id));
  }

  function splitClip(id: string) {
    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      const clip = prev[idx];
      const midpoint = (clip.trimStart + clip.trimEnd) / 2;
      const first: EditorClip = { ...clip, trimEnd: midpoint };
      const second: EditorClip = { ...clip, id: crypto.randomUUID(), trimStart: midpoint };
      return [...prev.slice(0, idx), first, second, ...prev.slice(idx + 1)];
    });
  }

  function moveClip(id: string, direction: "up" | "down") {
    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      const swapWith = direction === "up" ? idx - 1 : idx + 1;
      if (idx === -1 || swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  }

  async function handleExport() {
    if (clips.length === 0) return;
    setError(null);
    setRendering(true);
    try {
      const blob = await renderTimeline(
        clips.map((c) => ({ id: c.id, sourceUrl: c.sourceUrl, trimStart: c.trimStart, trimEnd: c.trimEnd })),
        { aspectRatio, fit }
      );
      const localUrl = URL.createObjectURL(blob);
      setPreviewUrl(localUrl);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const path = `${user.id}/${projectId}/${crypto.randomUUID()}.mp4`;
      const { error: uploadError } = await supabase.storage
        .from("exports")
        .upload(path, blob, { contentType: "video/mp4" });
      if (uploadError) throw uploadError;

      const { data: signed, error: signError } = await supabase.storage
        .from("exports")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      if (signError || !signed) throw signError ?? new Error("Failed to sign export URL");

      const totalDuration = clips.reduce((sum, c) => sum + (c.trimEnd - c.trimStart), 0);

      const res = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          videoUrl: signed.signedUrl,
          durationSeconds: totalDuration,
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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <h3 className="text-sm font-medium text-foreground">Timeline ({clips.length} clips)</h3>
        {clips.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Add completed generations to the timeline from the Generate tab.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {clips.map((clip, i) => (
              <ClipTrimmer
                key={clip.id}
                clip={clip}
                index={i}
                total={clips.length}
                onChangeTrim={updateTrim}
                onRemove={removeClip}
                onSplit={splitClip}
                onMove={moveClip}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-foreground">Preview / Export</h3>
        <div className="mt-3">
          <VideoPreviewPlayer
            src={previewUrl}
            aspectRatio={aspectRatio}
            label={previewUrl ? "Rendered export" : undefined}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label>Format</Label>
            <Select
              value={aspectRatio}
              onValueChange={(v) => v && setAspectRatio(v as AspectRatio)}
              items={ASPECT_RATIO_LABELS}
            >
              <SelectTrigger size="sm" aria-label="Export format">
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
            <Label>Framing</Label>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={fit === "fill" ? "secondary" : "ghost"}
                onClick={() => setFit("fill")}
                aria-pressed={fit === "fill"}
              >
                Crop to fill
              </Button>
              <Button
                size="sm"
                variant={fit === "fit" ? "secondary" : "ghost"}
                onClick={() => setFit("fit")}
                aria-pressed={fit === "fit"}
              >
                Fit with bars
              </Button>
            </div>
          </div>
        </div>
        {mismatchedClips > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {mismatchedClips} {mismatchedClips === 1 ? "clip doesn't" : "clips don't"} match{" "}
            {aspectRatio} and will be{" "}
            {fit === "fill" ? "cropped at the edges" : "shown with black bars"}.
          </p>
        )}

        <Button
          onClick={handleExport}
          disabled={clips.length === 0 || rendering}
          className="mt-4 w-full"
        >
          {rendering ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {rendering
            ? stage || (ffmpegLoading ? "Loading video engine…" : `Rendering… ${Math.round(progress * 100)}%`)
            : "Trim, merge & export"}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Rendering runs entirely in your browser. Longer timelines take longer and use more memory.
        </p>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
