"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PromptComposer } from "@/components/chat/PromptComposer";
import { GenerationList } from "@/components/chat/GenerationList";
import { Timeline } from "@/components/editor/Timeline";
import type { EditorClip } from "@/components/editor/ClipTrimmer";
import { CaptionGenerator } from "@/components/captions/CaptionGenerator";
import { CaptionResults } from "@/components/captions/CaptionResults";
import { BrandVoiceConfig } from "@/components/captions/BrandVoiceConfig";
import { ShareExportPanel } from "@/components/share/ShareExportPanel";
import { useGenerations } from "@/hooks/useGenerations";
import { getVideoMetadata } from "@/lib/utils/video";
import type { MusicTrack } from "@/components/editor/timeline-model";
import type { FitMode } from "@/components/editor/useFfmpeg";
import type {
  AspectRatio,
  BrandVoice,
  CaptionRecord,
  ExportRecord,
  Generation,
  Project,
} from "@/lib/types/domain";

const TABS = ["Generate", "Editor", "Captions", "Share"] as const;
type Tab = (typeof TABS)[number];

// Numbered steps in plain words: the app is used by people who aren't video or tech experts.
const TAB_LABELS: Record<Tab, string> = {
  Generate: "1. Make clips",
  Editor: "2. Put together",
  Captions: "3. Captions",
  Share: "4. Share",
};

export function ProjectWorkspace({
  project,
  userId,
  initialGenerations,
  initialCaptions,
  brandVoice,
}: {
  project: Project;
  userId: string;
  initialGenerations: Generation[];
  initialCaptions: CaptionRecord[];
  brandVoice: BrandVoice;
}) {
  const [tab, setTab] = useState<Tab>("Generate");
  const { generations, addOptimistic } = useGenerations(project.id, initialGenerations);
  const [clips, setClips] = useState<EditorClip[]>([]);
  const [activeExport, setActiveExport] = useState<ExportRecord | null>(null);
  const [exportLocalUrl, setExportLocalUrl] = useState<string | null>(null);
  const [captions, setCaptions] = useState<CaptionRecord[]>(initialCaptions);
  // Editor settings live here (not in Timeline) because tabs unmount when hidden: music and the
  // chosen shape should still be there after visiting Captions.
  const [music, setMusic] = useState<MusicTrack | null>(null);
  // Tall by default: Reels, TikTok and Shorts are all 9:16.
  const [exportAspect, setExportAspect] = useState<AspectRatio>("9:16");
  const [exportFit, setExportFit] = useState<FitMode>("fill");

  const clipSourceIds = useMemo(() => new Set(clips.map((c) => c.id)), [clips]);

  function handleAddToTimeline(generation: Generation) {
    const url = generation.video_url;
    if (!url) return;
    const requested = generation.duration_seconds;
    // Add straight away so the button flips to "Added" on the first press (and can't add the same
    // clip twice); the exact length and frame size are filled in once the browser has read them.
    setClips((prev) =>
      prev.some((c) => c.id === generation.id)
        ? prev
        : [
            ...prev,
            {
              id: generation.id,
              label: generation.prompt,
              sourceUrl: url,
              thumbnailUrl: generation.thumbnail_url,
              duration: requested,
              trimStart: 0,
              trimEnd: requested,
            },
          ]
    );
    getVideoMetadata(url)
      .then((meta) => {
        setClips((prev) =>
          prev.map((c) => {
            // Also update pieces split from this clip; only move an end the user hasn't trimmed.
            if (c.sourceUrl !== url) return c;
            const trimEnd = c.trimEnd === requested ? meta.duration : Math.min(c.trimEnd, meta.duration);
            return {
              ...c,
              duration: meta.duration,
              width: meta.width,
              height: meta.height,
              trimStart: Math.min(c.trimStart, Math.max(0, trimEnd - 0.1)),
              trimEnd,
            };
          })
        );
      })
      .catch(() => {
        // Keep the requested length if the browser can't read the file's details.
      });
  }


  const latestPrompt = generations[0]?.prompt ?? project.name;

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
      <div className="mx-auto mt-6 w-full max-w-6xl px-4">
        <div className="border-b border-border">
          <TabsList variant="line" className="h-auto flex-wrap justify-start gap-x-5 gap-y-1 bg-transparent p-0 sm:gap-x-6">
            {TABS.map((t) => (
              <TabsTrigger key={t} value={t} className="px-1 py-3 text-base">
                {TAB_LABELS[t]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <TabsContent value="Generate">
          <PromptComposer projectId={project.id} onSubmitted={addOptimistic} />
          <GenerationList
            generations={generations}
            onAddToTimeline={handleAddToTimeline}
            clipSourceIds={clipSourceIds}
          />
        </TabsContent>

        <TabsContent value="Editor">
          <Timeline
            projectId={project.id}
            clips={clips}
            setClips={setClips}
            music={music}
            setMusic={setMusic}
            aspectRatio={exportAspect}
            setAspectRatio={setExportAspect}
            fit={exportFit}
            setFit={setExportFit}
            finishedUrl={exportLocalUrl}
            onExportComplete={(record, localUrl) => {
              setActiveExport(record);
              setExportLocalUrl(localUrl);
            }}
            onContinue={() => setTab("Captions")}
          />
        </TabsContent>

        <TabsContent value="Captions">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <CaptionGenerator
                projectId={project.id}
                exportId={activeExport?.id}
                defaultContext={latestPrompt}
                onGenerated={(newCaptions) => setCaptions((prev) => [...newCaptions, ...prev])}
              />
              <CaptionResults captions={captions} />
            </div>
            <BrandVoiceConfig userId={userId} initial={brandVoice} />
          </div>
        </TabsContent>

        <TabsContent value="Share">
          <ShareExportPanel activeExport={activeExport} localUrl={exportLocalUrl} captions={captions} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
