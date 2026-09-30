// Client helpers for the /api/media pass-through (see src/app/api/media/route.ts).

// Same-origin URL for a remote clip/export. Blob/data URLs are already local and are returned as-is.
export function mediaUrl(url: string, downloadName?: string) {
  if (!/^https?:/.test(url)) return url;
  const params = new URLSearchParams({ url });
  if (downloadName) params.set("filename", downloadName);
  return `/api/media?${params}`;
}

// Starts a real file download (not "open the video in a new tab"), for remote or local URLs.
export function downloadFile(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = mediaUrl(url, filename);
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
