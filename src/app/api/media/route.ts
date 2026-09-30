import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Same-origin pass-through for generated clips and exports. Browsers ignore <a download> on
// cross-origin URLs (the video just opens), and ffmpeg-wasm needs CORS to read clip bytes; serving
// the file from our own origin fixes both. Only fal.ai media and this project's Supabase storage
// are allowed, so this can't be used to fetch arbitrary URLs.
function isAllowed(url: URL) {
  if (url.protocol !== "https:") return false;
  const host = url.hostname;
  if (host === "fal.media" || host.endsWith(".fal.media")) return true;
  if (host === "storage.googleapis.com" && url.pathname.startsWith("/falserverless/")) return true;
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabase) {
    try {
      if (host === new URL(supabase).hostname && url.pathname.startsWith("/storage/v1/object/")) {
        return true;
      }
    } catch {
      // bad env value: fall through to "not allowed"
    }
  }
  return false;
}

function safeFilename(name: string) {
  const cleaned = name.replace(/[^\w.\- ]+/g, "").trim().slice(0, 80);
  return cleaned || "video.mp4";
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const raw = request.nextUrl.searchParams.get("url");
  let target: URL;
  try {
    target = new URL(raw ?? "");
  } catch {
    return NextResponse.json({ error: "Missing or invalid url" }, { status: 400 });
  }
  if (!isAllowed(target)) {
    return NextResponse.json({ error: "This file can't be loaded here" }, { status: 403 });
  }

  const upstream = await fetch(target, { redirect: "error" });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: `Couldn't load the video (${upstream.status}). It may have expired.` },
      { status: 502 }
    );
  }

  const headers = new Headers({
    "Content-Type": upstream.headers.get("content-type") ?? "video/mp4",
    "Cache-Control": "private, max-age=3600",
  });
  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  const filename = request.nextUrl.searchParams.get("filename");
  if (filename) headers.set("Content-Disposition", `attachment; filename="${safeFilename(filename)}"`);

  return new Response(upstream.body, { status: 200, headers });
}
