"use client";

import { useState } from "react";
import { Check, Copy, Download, Share2 } from "lucide-react";
import { PLATFORM_LABELS, type CaptionRecord, type ExportRecord } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function ShareExportPanel({
  activeExport,
  captions,
}: {
  activeExport: ExportRecord | null;
  captions: CaptionRecord[];
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  async function copyCaption(caption: CaptionRecord) {
    await navigator.clipboard.writeText(`${caption.content}\n\n${caption.hashtags.join(" ")}`);
    setCopiedId(caption.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function nativeShare(caption?: CaptionRecord) {
    if (!activeExport) return;
    setShareStatus(null);
    try {
      if (navigator.share) {
        const text = caption ? `${caption.content}\n\n${caption.hashtags.join(" ")}` : undefined;

        if (navigator.canShare) {
          const res = await fetch(activeExport.video_url);
          const blob = await res.blob();
          const file = new File([blob], "ad.mp4", { type: "video/mp4" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], text, title: "Ad video" });
            return;
          }
        }
        await navigator.share({ text, url: activeExport.video_url, title: "Ad video" });
      } else {
        setShareStatus("Native sharing isn't supported on this device — use Download instead.");
      }
    } catch {
      // user cancelled the share sheet — not an error worth surfacing
    }
  }

  if (!activeExport) {
    return (
      <p className="text-sm text-muted-foreground">
        Export a video from the Editor tab first, then come back here to download or share it.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <video
            src={activeExport.video_url}
            controls
            className="max-h-[70vh] w-full rounded-lg bg-black object-contain"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <Button render={<a href={activeExport.video_url} download="alpha-origins-ad.mp4" />}>
              <Download size={14} /> Download MP4
            </Button>
            <Button variant="outline" onClick={() => nativeShare()}>
              <Share2 size={14} /> Share
            </Button>
          </div>
          {shareStatus && <p className="mt-2 text-xs text-muted-foreground">{shareStatus}</p>}
        </CardContent>
      </Card>

      {captions.length > 0 && (
        <div className="space-y-3">
          {captions.map((caption) => (
            <Card key={caption.id}>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{PLATFORM_LABELS[caption.platform]}</Badge>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => copyCaption(caption)}>
                      {copiedId === caption.id ? <Check size={12} /> : <Copy size={12} />}
                      {copiedId === caption.id ? "Copied" : "Copy caption"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => nativeShare(caption)}>
                      <Share2 size={12} /> Share with caption
                    </Button>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{caption.content}</p>
                <p className="mt-2 text-xs text-primary">{caption.hashtags.join(" ")}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
