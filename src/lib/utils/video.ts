// Client-only helpers — pure HTML5 video + canvas, no ffmpeg needed for these.
import type { AspectRatio } from "@/lib/types/domain";

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
}

export function getVideoMetadata(url: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    // No crossOrigin here: duration and size are readable without CORS (only pixels need it), so
    // this works even if the video host doesn't send CORS headers.
    video.src = url;
    video.onloadedmetadata = () =>
      resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
    video.onerror = () => reject(new Error("Could not read video metadata"));
  });
}

export function extractThumbnail(url: string, atSeconds = 0.1): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.src = url;
    video.crossOrigin = "anonymous";
    video.muted = true;

    video.onloadeddata = () => {
      video.currentTime = Math.min(atSeconds, video.duration || atSeconds);
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(video, 0, 0);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/jpeg", 0.85);
    };
    video.onerror = () => reject(new Error("Could not load video"));
  });
}

export function orientationOf(width: number, height: number): AspectRatio {
  if (width > height * 1.1) return "16:9";
  if (height > width * 1.1) return "9:16";
  return "1:1";
}
