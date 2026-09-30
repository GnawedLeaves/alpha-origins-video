import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { parseWebhookPayload } from "@/lib/fal/client";
import { verifyGenerationToken } from "@/lib/fal/webhook-token";

// fal.ai POSTs here when a queued job finishes (only reachable in prod / behind a public tunnel;
// see NEXT_PUBLIC_SITE_URL in .env.local.example). No user session exists on this request, so we
// use the service-role client, and only after checking the HMAC token we signed into the callback
// URL when submitting the job (see src/lib/fal/webhook-token.ts).
export async function POST(request: NextRequest) {
  const generationId = request.nextUrl.searchParams.get("generationId");
  const token = request.nextUrl.searchParams.get("token");
  if (!generationId || !token) {
    return NextResponse.json({ error: "Missing generationId or token" }, { status: 400 });
  }
  if (!verifyGenerationToken(generationId, token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = await request.json();
  const result = parseWebhookPayload(body);

  const supabase = createServiceRoleClient();

  if (result.status === "COMPLETED") {
    await supabase
      .from("generations")
      .update({
        status: "completed",
        video_url: result.videoUrl,
        thumbnail_url: result.thumbnailUrl,
      })
      .eq("id", generationId)
      // A video the user cancelled stays cancelled.
      .in("status", ["queued", "processing"]);
  } else if (result.status === "FAILED") {
    await supabase
      .from("generations")
      .update({ status: "failed", error: result.error })
      .eq("id", generationId)
      .in("status", ["queued", "processing"]);
  }

  return NextResponse.json({ ok: true });
}
