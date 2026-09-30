"use client";

import { useEffect, useRef, useState } from "react";
import { Film, Music, Plus } from "lucide-react";
import type { EditorClip } from "./ClipTrimmer";
import { clipLength, clipStarts, musicLength, type MusicTrack } from "./timeline-model";
import { cn } from "@/lib/utils";

export type TimelineSelection = { kind: "clip"; id: string } | { kind: "music" } | null;

const LABEL_WIDTH = 88;
const MIN_PX_PER_SEC = 36;
const DRAG_THRESHOLD = 5;

// The visual timeline: a ruler with the playhead, a video track of clip blocks (drag to reorder,
// tap to select) and a music track (drag to move where the music starts).
export function TimelineTracks({
  clips,
  music,
  time,
  total,
  selection,
  onSelect,
  onSeek,
  onReorder,
  onMusicOffset,
  onAddMusic,
}: {
  clips: EditorClip[];
  music: MusicTrack | null;
  time: number;
  total: number;
  selection: TimelineSelection;
  onSelect: (selection: TimelineSelection) => void;
  onSeek: (t: number) => void;
  onReorder: (from: number, to: number) => void;
  onMusicOffset: (offset: number) => void;
  onAddMusic: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Fires once right away with the initial size, then on every resize.
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit the whole video in view (leaving room to drop music after the end), but never so small
  // that blocks become hard to grab; then it scrolls sideways.
  const span = Math.max(total, 5) * 1.08;
  const pxPerSec = Math.max(MIN_PX_PER_SEC, (width - 8) / span);
  const contentWidth = Math.max(width, span * pxPerSec);
  const starts = clipStarts(clips);

  // ----- dragging a clip block to reorder -----
  const [clipDrag, setClipDrag] = useState<{ index: number; startX: number; dx: number; moved: boolean } | null>(
    null
  );
  function dropIndexFor(index: number, dx: number) {
    const center = (starts[index] + clipLength(clips[index]) / 2) * pxPerSec + dx;
    let target = 0;
    for (let k = 0; k < clips.length; k++) {
      if (k === index) continue;
      const mid = (starts[k] + clipLength(clips[k]) / 2) * pxPerSec;
      if (center > mid) target++;
    }
    return target;
  }

  // ----- dragging the music block -----
  const [musicDrag, setMusicDrag] = useState<{ startX: number; startOffset: number; moved: boolean } | null>(null);

  // ----- scrubbing on the ruler -----
  const [scrubbing, setScrubbing] = useState(false);
  function timeFromEvent(e: React.PointerEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return Math.max(0, Math.min(total, (e.clientX - rect.left) / pxPerSec));
  }

  const rulerStep = pxPerSec >= 60 ? 1 : pxPerSec >= 30 ? 2 : 5;
  const ticks: number[] = [];
  for (let t = 0; t <= span; t += rulerStep) ticks.push(t);

  const dropTarget = clipDrag?.moved ? dropIndexFor(clipDrag.index, clipDrag.dx) : null;
  // x position of the insertion marker for the drop target.
  let dropX: number | null = null;
  if (clipDrag && dropTarget !== null) {
    const others = clips.map((c, k) => ({ c, k })).filter(({ k }) => k !== clipDrag.index);
    const before = others.slice(0, dropTarget).reduce((sum, { c }) => sum + clipLength(c), 0);
    dropX = before * pxPerSec;
  }

  const mLen = music ? musicLength(music, total) : 0;
  const musicBlockLen = music ? Math.max(0.5, Math.min(music.duration - music.trimStart, span - music.offset)) : 0;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex">
        {/* Track labels */}
        <div className="shrink-0 border-r border-border" style={{ width: LABEL_WIDTH }}>
          <div className="h-8 border-b border-border" />
          <div className="flex h-20 items-center gap-1.5 px-3 font-medium">
            <Film className="size-4" /> Video
          </div>
          <div className="flex h-14 items-center gap-1.5 border-t border-border px-3 font-medium">
            <Music className="size-4" /> Music
          </div>
        </div>

        <div ref={scrollRef} className="relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div className="relative" style={{ width: contentWidth }}>
            {/* Ruler: tap or drag to move the playhead */}
            <div
              className="relative h-8 cursor-pointer touch-none border-b border-border select-none"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setScrubbing(true);
                onSeek(timeFromEvent(e));
              }}
              onPointerMove={(e) => scrubbing && onSeek(timeFromEvent(e))}
              onPointerUp={() => setScrubbing(false)}
              onPointerCancel={() => setScrubbing(false)}
              role="slider"
              aria-label="Playhead position"
              aria-valuemin={0}
              aria-valuemax={Math.round(total * 10) / 10}
              aria-valuenow={Math.round(time * 10) / 10}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") onSeek(Math.min(total, time + 0.5));
                if (e.key === "ArrowLeft") onSeek(Math.max(0, time - 0.5));
              }}
            >
              {ticks.map((t) => (
                <div key={t} className="absolute top-0 h-full" style={{ left: t * pxPerSec }}>
                  <div className="h-2 w-px bg-foreground/30" />
                  <span className="absolute top-2 left-1 font-mono text-xs text-muted-foreground">
                    {t}s
                  </span>
                </div>
              ))}
            </div>

            {/* Video track */}
            <div className="relative h-20">
              {clips.length === 0 && (
                <p className="absolute inset-0 flex items-center px-3 text-muted-foreground">
                  Clips you add from step 1 appear here.
                </p>
              )}
              {clips.map((clip, i) => {
                const len = clipLength(clip);
                const dragging = clipDrag?.index === i && clipDrag.moved;
                const selected = selection?.kind === "clip" && selection.id === clip.id;
                return (
                  <div
                    key={clip.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Clip ${i + 1}, ${len.toFixed(1)} seconds${selected ? ", selected" : ""}`}
                    aria-pressed={selected}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect({ kind: "clip", id: clip.id });
                      }
                    }}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setClipDrag({ index: i, startX: e.clientX, dx: 0, moved: false });
                    }}
                    onPointerMove={(e) => {
                      if (!clipDrag || clipDrag.index !== i) return;
                      const dx = e.clientX - clipDrag.startX;
                      setClipDrag({ ...clipDrag, dx, moved: clipDrag.moved || Math.abs(dx) > DRAG_THRESHOLD });
                    }}
                    onPointerUp={() => {
                      if (!clipDrag || clipDrag.index !== i) return;
                      if (clipDrag.moved) {
                        const to = dropIndexFor(i, clipDrag.dx);
                        if (to !== i) onReorder(i, to);
                      } else {
                        onSelect({ kind: "clip", id: clip.id });
                        onSeek(starts[i]);
                      }
                      setClipDrag(null);
                    }}
                    onPointerCancel={() => setClipDrag(null)}
                    className={cn(
                      "absolute top-2 bottom-2 cursor-grab touch-none overflow-hidden rounded-lg bg-black select-none active:cursor-grabbing",
                      selected ? "ring-4 ring-primary" : "ring-1 ring-foreground/20",
                      dragging && "z-20 opacity-90 shadow-subtle-2"
                    )}
                    style={{
                      left: starts[i] * pxPerSec + 2,
                      width: Math.max(24, len * pxPerSec - 4),
                      transform: dragging ? `translateX(${clipDrag!.dx}px)` : undefined,
                    }}
                  >
                    <video
                      src={`${clip.sourceUrl}#t=${(clip.trimStart + 0.1).toFixed(1)}`}
                      preload="metadata"
                      muted
                      playsInline
                      className="pointer-events-none h-full w-full object-cover opacity-80"
                    />
                    <span className="absolute top-1 left-1 rounded bg-black/70 px-1.5 text-sm font-semibold text-white">
                      {i + 1}
                    </span>
                    <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 font-mono text-xs text-white">
                      {len.toFixed(1)}s
                    </span>
                  </div>
                );
              })}
              {dropX !== null && (
                <div
                  className="pointer-events-none absolute top-1 bottom-1 z-30 w-1 -translate-x-1/2 rounded bg-highlighter-yellow ring-1 ring-forest-ink"
                  style={{ left: dropX }}
                />
              )}
            </div>

            {/* Music track */}
            <div className="relative h-14 border-t border-border">
              {music ? (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Music: ${music.name}, starts at ${music.offset.toFixed(1)} seconds`}
                  aria-pressed={selection?.kind === "music"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect({ kind: "music" });
                    }
                    if (e.key === "ArrowRight") onMusicOffset(Math.min(total - 0.5, music.offset + 0.5));
                    if (e.key === "ArrowLeft") onMusicOffset(Math.max(0, music.offset - 0.5));
                  }}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setMusicDrag({ startX: e.clientX, startOffset: music.offset, moved: false });
                  }}
                  onPointerMove={(e) => {
                    if (!musicDrag) return;
                    const dx = e.clientX - musicDrag.startX;
                    const moved = musicDrag.moved || Math.abs(dx) > DRAG_THRESHOLD;
                    if (moved) {
                      let offset = musicDrag.startOffset + dx / pxPerSec;
                      offset = Math.max(0, Math.min(Math.max(0, total - 0.5), offset));
                      if (offset < 0.25) offset = 0; // snap to the start
                      onMusicOffset(Math.round(offset * 10) / 10);
                    }
                    if (moved !== musicDrag.moved) setMusicDrag({ ...musicDrag, moved });
                  }}
                  onPointerUp={() => {
                    if (musicDrag && !musicDrag.moved) onSelect({ kind: "music" });
                    setMusicDrag(null);
                  }}
                  onPointerCancel={() => setMusicDrag(null)}
                  className={cn(
                    "absolute top-2 bottom-2 flex cursor-grab touch-none items-center gap-1.5 overflow-hidden rounded-lg bg-sticky-note-teal px-2 text-sm font-medium text-forest-ink select-none active:cursor-grabbing",
                    selection?.kind === "music" ? "ring-4 ring-primary" : "ring-1 ring-forest-ink/30"
                  )}
                  style={{ left: music.offset * pxPerSec + 2, width: Math.max(40, musicBlockLen * pxPerSec - 4) }}
                >
                  {/* The part after the video ends is shown faded: it won't be heard. */}
                  {mLen < musicBlockLen && (
                    <div
                      className="pointer-events-none absolute inset-y-0 right-0 bg-background/60"
                      style={{ width: (musicBlockLen - mLen) * pxPerSec }}
                    />
                  )}
                  <Music className="relative size-4 shrink-0" />
                  <span className="relative truncate">{music.name}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onAddMusic}
                  className="absolute top-2 bottom-2 left-2 flex items-center gap-1.5 rounded-lg border-2 border-dashed border-input px-3 font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Plus className="size-4" /> Add music
                </button>
              )}
            </div>

            {/* Playhead across all tracks */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-40 w-0.5 bg-destructive"
              style={{ left: time * pxPerSec }}
            >
              <div className="absolute -top-0 -left-1.5 size-3.5 rotate-45 rounded-sm bg-destructive" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
