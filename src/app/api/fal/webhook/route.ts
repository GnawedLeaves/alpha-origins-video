import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { parseWebhookPayload } from "@/lib/fal/client";

// fal.ai POSTs here when a queued job finishes (only reachable in prod / behind a public tunnel;
// see NEXT_PUBLIC_SITE_URL in .env.local.example). No user session exists on this request, so we
// use the service-role client and trust generationId from the query string, which we generated
// ourselves when submitting the job.
export async function POST(request: NextRequest) {
  const generationId = request.nextUrl.searchParams.get("generationId");
  if (!generationId) {
    return NextResponse.json({ error: "Missing generationId" }, { status: 400 });
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
      .eq("id", generationId);
  } else if (result.status === "FAILED") {
    await supabase
      .from("generations")
      .update({ status: "failed", error: result.error })
      .eq("id", generationId);
  }

  return NextResponse.json({ ok: true });
}
