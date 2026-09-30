"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { PLATFORM_LABELS, type CaptionRecord } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function CaptionResults({ captions }: { captions: CaptionRecord[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copy(caption: CaptionRecord) {
    const text = `${caption.content}\n\n${caption.hashtags.join(" ")}`;
    await navigator.clipboard.writeText(text);
    setCopiedId(caption.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  if (captions.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        Generated captions for each platform will show up here.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {captions.map((caption) => (
        <Card key={caption.id}>
          <CardContent>
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{PLATFORM_LABELS[caption.platform]}</Badge>
              <Button variant="ghost" size="sm" onClick={() => copy(caption)}>
                {copiedId === caption.id ? <Check size={12} /> : <Copy size={12} />}
                {copiedId === caption.id ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{caption.content}</p>
            <p className="mt-2 text-xs text-muted-foreground">{caption.hashtags.join(" ")}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
