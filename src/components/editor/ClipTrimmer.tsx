"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Pause, Play, Scissors, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

export interface EditorClip {
  id: string;
  label: string;
  sourceUrl: string;
  thumbnailUrl?: string | null;
  duration: number;
  // Source frame size, when the browser could read it (used to warn about crop/letterboxing).
  width?: number;
  height?: number;
  trimStart: number;
  trimEnd: number;
}

// Cuts closer than this to either end would leave a uselessly short piece.
const MIN_PIECE = 0.3;

export function ClipTrimmer({
  clip,
  index,
  total,
  onChangeTrim,
  onRemove,
  onSplit,
  onMove,
}: {
  clip: EditorClip;
  index: number;
  total: number;
  onChangeTrim: (id: string, trimStart: number, trimEnd: number) => void;
  onRemove: (id: string) => void;
  onSplit: (id: string, at: number) => void;
  onMove: (id: string, direction: "up" | "down") => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(clip.trimStart);

  // Stop exactly at the end of the kept part. `timeupdate` only fires ~4x a second, so poll with
  // requestAnimationFrame while playing.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const v = videoRef.current;
      if (!v) return;
      setCurrent(v.currentTime);
      if (v.currentTime >= clip.trimEnd) {
        v.pause();
        v.currentTime = clip.trimEnd;
        setCurrent(clip.trimEnd);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, clip.trimEnd]);

  async function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (!v.paused) {
      v.pause();
      return;
    }
    // Start from the beginning of the kept part if we're outside it or at its end.
    if (v.currentTime < clip.trimStart || v.currentTime >= clip.trimEnd - 0.05) {
      v.currentTime = clip.trimStart;
    }
    try {
      await v.play();
    } catch {
      // play() rejects if interrupted by a pause; nothing to do
    }
  }

  function seek(time: number) {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = time;
    setCurrent(time);
  }

  function handleTrimChange(value: number | readonly number[]) {
    const [start, end] = value as number[];
    const nextStart = Math.min(start, end - 0.1);
    const nextEnd = Math.max(end, start + 0.1);
    // Show the frame at whichever handle moved, so the cut point is visible.
    seek(nextStart !== clip.trimStart ? nextStart : nextEnd);
    onChangeTrim(clip.id, nextStart, nextEnd);
  }

  const canCutHere =
    current > clip.trimStart + MIN_PIECE && current < clip.trimEnd - MIN_PIECE;
  const kept = clip.trimEnd - clip.trimStart;

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Clip {index + 1}</p>
            <p className="line-clamp-2 text-sm text-muted-foreground">{clip.label}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onMove(clip.id, "up")}
              disabled={index === 0}
              aria-label="Move earlier"
              title="Move earlier"
            >
              <ArrowUp />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onMove(clip.id, "down")}
              disabled={index === total - 1}
              aria-label="Move later"
              title="Move later"
            >
              <ArrowDown />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(clip.id)}
              aria-label="Remove clip"
              title="Remove clip"
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </div>
        </div>

        <video
          ref={videoRef}
          src={clip.sourceUrl}
          preload="auto"
          playsInline
          onClick={togglePlay}
          onLoadedMetadata={(e) => {
            e.currentTarget.currentTime = clip.trimStart;
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onSeeked={(e) => setCurrent(e.currentTarget.currentTime)}
          className="max-h-80 w-full cursor-pointer rounded-lg bg-black object-contain"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={togglePlay} className="h-11 px-4 text-base">
            {playing ? <Pause /> : <Play />}
            {playing ? "Pause" : "Play clip"}
          </Button>
          <Button
            variant="outline"
            onClick={() => onSplit(clip.id, current)}
            disabled={!canCutHere}
            title={canCutHere ? "Split into two clips at this point" : "Pause inside the clip to cut there"}
            className="h-11 px-4 text-base"
          >
            <Scissors /> Cut here
          </Button>
          <span className="ml-auto font-mono text-sm text-muted-foreground tabular-nums">
            {current.toFixed(1)}s
          </span>
        </div>

        <div className="px-1 pt-1">
          <Slider
            min={0}
            max={clip.duration}
            step={0.1}
            value={[clip.trimStart, clip.trimEnd]}
            onValueChange={handleTrimChange}
            aria-label="Part of the clip to keep"
          />
          <p className="mt-2 text-sm text-muted-foreground">
            Keeping {clip.trimStart.toFixed(1)}s – {clip.trimEnd.toFixed(1)}s ({kept.toFixed(1)}s of{" "}
            {clip.duration.toFixed(1)}s). Drag the ends to trim.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
