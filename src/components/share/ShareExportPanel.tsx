"use client";

import { useState } from "react";
import { Check, Copy, Download, Share2 } from "lucide-react";
import { PLATFORM_LABELS, type CaptionRecord, type ExportRecord } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { downloadFile, mediaUrl } from "@/lib/media";

export function ShareExportPanel({
  activeExport,
  localUrl,
  captions,
}: {
  activeExport: ExportRecord | null;
  // The just-rendered video still in memory (blob: URL); faster than fetching it back.
  localUrl?: string | null;
  captions: CaptionRecord[];
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  async function copyCaption(caption: CaptionRecord) {
    await navigator.clipboard.writeText(`${caption.content}\n\n${caption.hashtags.join(" ")}`);
    setCopiedId(caption.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  // Which share button is busy (fetching the video for the share sheet): a caption id or "video".
  const [sharing, setSharing] = useState<string | null>(null);

  async function nativeShare(caption?: CaptionRecord) {
    if (!activeExport || sharing) return;
    setShareStatus(null);
    setSharing(caption?.id ?? "video");
    try {
      if (navigator.share) {
        const text = caption ? `${caption.content}\n\n${caption.hashtags.join(" ")}` : undefined;

        if (navigator.canShare) {
          const res = await fetch(localUrl ?? mediaUrl(activeExport.video_url));
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
    } finally {
      setSharing(null);
    }
  }

  if (!activeExport) {
    return (
      <div className="max-w-md rounded-xl bg-sticky-note-teal p-6 text-forest-ink">
        <p className="font-semibold">Nothing to share yet</p>
        <p className="mt-1 text-sm">
          Export a video from the Editor tab first, then come back here to download or share it.
        </p>
      </div>
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
            <Button
              onClick={() => downloadFile(localUrl ?? activeExport.video_url, "alpha-origins-ad.mp4")}
              className="h-11 px-4 text-base"
            >
              <Download /> Download video
            </Button>
            <Button
              variant="outline"
              onClick={() => nativeShare()}
              loading={sharing === "video"}
              className="h-11 px-4 text-base"
            >
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => nativeShare(caption)}
                      loading={sharing === caption.id}
                    >
                      <Share2 size={12} /> Share with caption
                    </Button>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{caption.content}</p>
                <p className="mt-2 text-xs text-muted-foreground">{caption.hashtags.join(" ")}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
