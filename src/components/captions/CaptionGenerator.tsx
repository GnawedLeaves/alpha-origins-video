"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { PLATFORM_LABELS, type CaptionRecord, type Platform } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ALL_PLATFORMS = Object.keys(PLATFORM_LABELS) as Platform[];

export function CaptionGenerator({
  projectId,
  exportId,
  defaultContext,
  onGenerated,
}: {
  projectId: string;
  exportId?: string;
  defaultContext: string;
  onGenerated: (captions: CaptionRecord[]) => void;
}) {
  const [context, setContext] = useState(defaultContext);
  const [selected, setSelected] = useState<Set<Platform>>(new Set(ALL_PLATFORMS));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(platform: Platform) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
  }

  async function handleGenerate() {
    if (!context.trim() || selected.size === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/captions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          exportId,
          videoContext: context,
          platforms: Array.from(selected),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Request failed");
      onGenerated(body.captions as CaptionRecord[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent>
        <Label htmlFor="video-context">Video context</Label>
        <Textarea
          id="video-context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={2}
          placeholder="What's this ad about? e.g. 'New grain-free salmon recipe launch, puppy enjoying a bowl at sunrise'"
          className="mt-1 resize-none"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {ALL_PLATFORMS.map((platform) => (
            <button
              key={platform}
              type="button"
              onClick={() => toggle(platform)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                selected.has(platform)
                  ? "border-selected bg-selected text-selected-foreground"
                  : "border-input text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {PLATFORM_LABELS[platform]}
            </button>
          ))}
        </div>

        <Button
          onClick={handleGenerate}
          disabled={loading || !context.trim() || selected.size === 0}
          className="mt-4"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Generate captions
        </Button>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
