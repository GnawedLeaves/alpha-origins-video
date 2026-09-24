// Client-only helpers — pure HTML5 video + canvas, no ffmpeg needed for these.

export function getVideoDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;
    video.crossOrigin = "anonymous";
    video.onloadedmetadata = () => resolve(video.duration);
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
