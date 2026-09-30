import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getJobStatus } from "@/lib/fal/client";

// Dev/no-webhook fallback: the client polls this route, which checks fal.ai directly and
// updates the generations row so both the webhook and polling paths converge on the same state.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: generation, error } = await supabase
    .from("generations")
    .select("*")
    .eq("fal_request_id", requestId)
    .eq("owner_id", user.id)
    .single();

  if (error || !generation) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }

  if (generation.status === "completed" || generation.status === "failed") {
    return NextResponse.json({ status: generation.status, generation });
  }

  const result = await getJobStatus(
    generation.model,
    requestId,
    !!generation.reference_image_url
  );

  if (result.status === "COMPLETED") {
    const { data: updated } = await supabase
      .from("generations")
      .update({
        status: "completed",
        video_url: result.videoUrl,
        thumbnail_url: result.thumbnailUrl,
      })
      .eq("id", generation.id)
      .select()
      .single();
    return NextResponse.json({ status: "completed", generation: updated });
  }

  if (result.status === "FAILED") {
    const { data: updated } = await supabase
      .from("generations")
      .update({ status: "failed", error: result.error })
      .eq("id", generation.id)
      .select()
      .single();
    return NextResponse.json({ status: "failed", generation: updated });
  }

  return NextResponse.json({ status: "processing", generation });
}
