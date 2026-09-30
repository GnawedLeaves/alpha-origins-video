"use client";

import { Music, RefreshCw, Trash2 } from "lucide-react";
import { musicLength, type MusicTrack } from "./timeline-model";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

// Settings for the music track, shown when the music block on the timeline is selected.
export function MusicPanel({
  music,
  total,
  onChange,
  onReplace,
  onRemove,
}: {
  music: MusicTrack;
  total: number;
  onChange: (patch: Partial<MusicTrack>) => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const heard = musicLength(music, total);
  const maxOffset = Math.max(0, total - 0.5);
  const maxSkip = Math.max(0, music.duration - 1);

  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sticky-note-teal text-forest-ink">
              <Music className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{music.name}</p>
              <p className="text-sm text-muted-foreground">
                Song is {music.duration.toFixed(0)}s long · plays for {heard.toFixed(1)}s in your video
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onReplace} className="h-10 px-3 text-base">
              <RefreshCw /> Change song
            </Button>
            <Button
              variant="ghost"
              onClick={onRemove}
              className="h-10 px-3 text-base hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 /> Remove
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Music starts at {music.offset.toFixed(1)}s of the video</Label>
          <Slider
            min={0}
            max={maxOffset || 0.1}
            step={0.1}
            value={[Math.min(music.offset, maxOffset)]}
            onValueChange={(v) => onChange({ offset: (v as number[])[0] })}
            disabled={maxOffset === 0}
            aria-label="When the music starts"
          />
          <p className="text-sm text-muted-foreground">You can also drag the music on the timeline.</p>
        </div>

        <div className="space-y-2">
          <Label>Start the song from {music.trimStart.toFixed(1)}s (skip the intro)</Label>
          <Slider
            min={0}
            max={maxSkip || 0.1}
            step={0.5}
            value={[Math.min(music.trimStart, maxSkip)]}
            onValueChange={(v) => onChange({ trimStart: (v as number[])[0] })}
            disabled={maxSkip === 0}
            aria-label="Where in the song to start"
          />
        </div>

        <div className="space-y-2">
          <Label>Volume {Math.round(music.volume * 100)}%</Label>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={[music.volume]}
            onValueChange={(v) => onChange({ volume: (v as number[])[0] })}
            aria-label="Music volume"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={music.fadeOut}
            onChange={(e) => onChange({ fadeOut: e.target.checked })}
            className="size-5 accent-primary"
          />
          <span>Fade the music out at the end</span>
        </label>
      </CardContent>
    </Card>
  );
}
