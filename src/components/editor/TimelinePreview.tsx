"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { AspectRatio } from "@/lib/types/domain";
import type { EditorClip } from "./ClipTrimmer";
import type { FitMode } from "./useFfmpeg";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FRAME: Record<AspectRatio, string> = {
  "9:16": "aspect-[9/16] h-[min(60vh,520px)]",
  "1:1": "aspect-square h-[min(60vh,520px)]",
  "16:9": "aspect-video w-full",
};

// Plays the timeline as it will be exported — clips in order, only their kept parts, framed like
// the export (object-cover ≈ "zoom to fill", object-contain ≈ "show whole clip") — without
// waiting for ffmpeg to render anything.
export function TimelinePreview({
  clips,
  aspectRatio,
  fit,
}: {
  clips: EditorClip[];
  aspectRatio: AspectRatio;
  fit: FitMode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  // Keep playing across the switch to the next clip's source.
  const wantPlay = useRef(false);

  const clip = clips[Math.min(index, clips.length - 1)];
  const totalLength = clips.reduce((sum, c) => sum + (c.trimEnd - c.trimStart), 0);

  useEffect(() => {
    if (!playing || !clip) return;
    let frame = 0;
    const tick = () => {
      const v = videoRef.current;
      if (!v) return;
      if (v.currentTime >= clip.trimEnd) {
        if (index < clips.length - 1) {
          wantPlay.current = true;
          setIndex(index + 1);
        } else {
          wantPlay.current = false;
          v.pause();
          setFinished(true);
        }
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, clip, index, clips.length]);

  if (!clip) return null;

  async function play() {
    const v = videoRef.current;
    if (!v) return;
    wantPlay.current = true;
    setFinished(false);
    if (v.currentTime < clip.trimStart || v.currentTime >= clip.trimEnd - 0.05) {
      v.currentTime = clip.trimStart;
    }
    try {
      await v.play();
    } catch {
      // interrupted by a pause
    }
  }

  function pause() {
    wantPlay.current = false;
    videoRef.current?.pause();
  }

  function restart() {
    setFinished(false);
    if (index === 0) {
      play(); // play() rewinds to the start of the kept part
    } else {
      wantPlay.current = true;
      setIndex(0);
    }
  }

  const atEnd = finished && !playing;

  return (
    <div>
      <div className={cn("mx-auto max-w-full overflow-hidden rounded-xl bg-black", FRAME[aspectRatio])}>
        <video
          ref={videoRef}
          // Remount per clip so each one loads and seeks to its own start (both pieces of a cut
          // share the same source file).
          key={`${index}-${clip.id}`}
          src={clip.sourceUrl}
          preload="auto"
          playsInline
          onClick={() => (playing ? pause() : play())}
          onLoadedMetadata={(e) => {
            e.currentTarget.currentTime = clip.trimStart;
            if (wantPlay.current) e.currentTarget.play().catch(() => {});
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className={cn(
            "h-full w-full cursor-pointer",
            fit === "fill" ? "object-cover" : "object-contain"
          )}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {atEnd ? (
          <Button onClick={restart} className="h-11 px-4 text-base">
            <RotateCcw /> Watch again
          </Button>
        ) : (
          <Button onClick={() => (playing ? pause() : play())} className="h-11 px-4 text-base">
            {playing ? <Pause /> : <Play />}
            {playing ? "Pause" : index === 0 ? "Play preview" : "Continue"}
          </Button>
        )}
        {index > 0 && !atEnd && (
          <Button variant="ghost" onClick={restart} className="h-11 px-3 text-base">
            <RotateCcw /> From the start
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">
          Clip {index + 1} of {clips.length} · {totalLength.toFixed(1)}s total
        </span>
      </div>
    </div>
  );
}
