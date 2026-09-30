"use client";

import { useCallback, useRef, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type { AspectRatio } from "@/lib/types/domain";
import { mediaUrl } from "@/lib/media";

const CORE_BASE_URL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

// Every clip is scaled to one frame size and frame rate so the concat step can stream-copy.
// Different fal.ai models output different sizes, and concat with `-c copy` breaks on mismatches.
// Audio is dropped: the text/image-to-video models in src/lib/fal/models.ts produce silent video,
// and mixing clips with and without an audio track would also break concat.
const OUTPUT_FPS = 30;

export const EXPORT_SIZES: Record<AspectRatio, { width: number; height: number }> = {
  "9:16": { width: 720, height: 1280 },
  "16:9": { width: 1280, height: 720 },
  "1:1": { width: 720, height: 720 },
};

// "fill" crops clips to cover the whole frame (no bars); "fit" letterboxes them with black bars.
export type FitMode = "fill" | "fit";

export interface ExportFormat {
  aspectRatio: AspectRatio;
  fit: FitMode;
}

function normalizeFilter({ aspectRatio, fit }: ExportFormat) {
  const { width: w, height: h } = EXPORT_SIZES[aspectRatio];
  const resize =
    fit === "fill"
      ? `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`
      : `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`;
  return `${resize},setsar=1,fps=${OUTPUT_FPS}`;
}

export interface TimelineClip {
  id: string;
  sourceUrl: string;
  trimStart: number;
  trimEnd: number;
}

export function useFfmpeg() {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<string>("");

  const ensureLoaded = useCallback(async () => {
    if (ffmpegRef.current && loaded) return ffmpegRef.current;

    setLoading(true);
    const ffmpeg = new FFmpeg();
    ffmpeg.on("progress", ({ progress: p }) => setProgress(Math.min(1, Math.max(0, p))));

    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
    });

    ffmpegRef.current = ffmpeg;
    setLoaded(true);
    setLoading(false);
    return ffmpeg;
  }, [loaded]);

  // Trims each clip to [trimStart, trimEnd] (re-encoding for frame-accurate cuts and a uniform
  // frame size for the chosen export format), then concats them in order into a single MP4.
  const renderTimeline = useCallback(
    async (clips: TimelineClip[], format: ExportFormat): Promise<Blob> => {
      const ffmpeg = await ensureLoaded();
      const outputs: string[] = [];

      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        setStage(`Trimming clip ${i + 1} of ${clips.length}`);
        const inputName = `in_${i}.mp4`;
        const outputName = `trim_${i}.mp4`;

        // Through our own origin: fal's CDN may not send the CORS headers fetch() needs.
        await ffmpeg.writeFile(inputName, await fetchFile(mediaUrl(clip.sourceUrl)));
        await ffmpeg.exec([
          "-ss",
          String(clip.trimStart),
          "-to",
          String(clip.trimEnd),
          "-i",
          inputName,
          "-vf",
          normalizeFilter(format),
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-pix_fmt",
          "yuv420p",
          "-an",
          outputName,
        ]);
        outputs.push(outputName);
      }

      setStage("Merging clips");
      const listContent = outputs.map((name) => `file '${name}'`).join("\n");
      await ffmpeg.writeFile("concat_list.txt", listContent);
      await ffmpeg.exec([
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        "concat_list.txt",
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        "final.mp4",
      ]);

      const data = await ffmpeg.readFile("final.mp4");
      setStage("");
      setProgress(0);
      return new Blob([data as Uint8Array<ArrayBuffer>], { type: "video/mp4" });
    },
    [ensureLoaded]
  );

  return { renderTimeline, loading, loaded, progress, stage };
}
