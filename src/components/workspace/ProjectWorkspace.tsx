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
import { getVideoMetadata, type VideoMetadata } from "@/lib/utils/video";
import type { BrandVoice, CaptionRecord, ExportRecord, Generation, Project } from "@/lib/types/domain";

const TABS = ["Generate", "Editor", "Captions", "Share"] as const;
type Tab = (typeof TABS)[number];

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
  const [captions, setCaptions] = useState<CaptionRecord[]>(initialCaptions);

  const clipSourceIds = useMemo(() => new Set(clips.map((c) => c.id)), [clips]);

  async function handleAddToTimeline(generation: Generation) {
    if (!generation.video_url) return;
    let meta: Partial<VideoMetadata> = {};
    try {
      meta = await getVideoMetadata(generation.video_url);
    } catch {
      // fall back to the requested duration if metadata probing fails (e.g. CORS)
    }
    const duration = meta.duration ?? generation.duration_seconds;
    setClips((prev) => [
      ...prev,
      {
        id: generation.id,
        label: generation.prompt,
        sourceUrl: generation.video_url!,
        thumbnailUrl: generation.thumbnail_url,
        duration,
        width: meta.width,
        height: meta.height,
        trimStart: 0,
        trimEnd: duration,
      },
    ]);
  }

  const latestPrompt = generations[0]?.prompt ?? project.name;

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
      <div className="mx-auto mt-6 w-full max-w-6xl px-4">
        <div className="border-b border-border">
          <TabsList variant="line" className="h-auto gap-6 bg-transparent p-0">
            {TABS.map((t) => (
              <TabsTrigger key={t} value={t} className="px-1 py-3 text-body-sm">
                {t}
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
            onExportComplete={(record) => {
              setActiveExport(record);
              setTab("Captions");
            }}
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
          <ShareExportPanel activeExport={activeExport} captions={captions} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
