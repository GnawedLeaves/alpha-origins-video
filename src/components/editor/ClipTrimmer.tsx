"use client";

import { ArrowDown, ArrowUp, Scissors, Trash2 } from "lucide-react";
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
  onSplit: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
}) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-start gap-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
            {clip.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={clip.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{clip.label}</p>
            <p className="text-xs text-muted-foreground">
              {clip.trimStart.toFixed(1)}s – {clip.trimEnd.toFixed(1)}s of{" "}
              {clip.duration.toFixed(1)}s
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onMove(clip.id, "up")}
              disabled={index === 0}
              title="Move earlier"
            >
              <ArrowUp size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onMove(clip.id, "down")}
              disabled={index === total - 1}
              title="Move later"
            >
              <ArrowDown size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onSplit(clip.id)}
              title="Split at midpoint"
            >
              <Scissors size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onRemove(clip.id)}
              title="Remove"
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>

        <div className="mt-4 px-1">
          <Slider
            min={0}
            max={clip.duration}
            step={0.1}
            value={[clip.trimStart, clip.trimEnd]}
            onValueChange={(value) => {
              const [start, end] = value as number[];
              onChangeTrim(clip.id, Math.min(start, end - 0.1), Math.max(end, start + 0.1));
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
