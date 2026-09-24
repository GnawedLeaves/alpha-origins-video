"use client";

import { useCallback, useRef, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const CORE_BASE_URL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

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

  // Trims each clip to [trimStart, trimEnd] (re-encoding for frame-accurate cuts), then concats
  // them in order into a single MP4. Returns the rendered Blob.
  const renderTimeline = useCallback(
    async (clips: TimelineClip[]): Promise<Blob> => {
      const ffmpeg = await ensureLoaded();
      const outputs: string[] = [];

      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        setStage(`Trimming clip ${i + 1} of ${clips.length}`);
        const inputName = `in_${i}.mp4`;
        const outputName = `trim_${i}.mp4`;

        await ffmpeg.writeFile(inputName, await fetchFile(clip.sourceUrl));
        await ffmpeg.exec([
          "-ss",
          String(clip.trimStart),
          "-to",
          String(clip.trimEnd),
          "-i",
          inputName,
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-c:a",
          "aac",
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
