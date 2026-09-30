import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getJobStatus, RetryableFalError } from "@/lib/fal/client";
import type { GenerationStatus } from "@/lib/types/domain";

const PENDING: GenerationStatus[] = ["queued", "processing"];

// Dev/no-webhook fallback: the client polls this route, which checks fal.ai directly and
// updates the generations row so both the webhook and polling paths converge on the same state.
// Always answers with JSON: `retryable: true` means "couldn't check right now, ask again later".
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    }

    const { data: generation, error } = await supabase
      .from("generations")
      .select("*")
      .eq("fal_request_id", requestId)
      .eq("owner_id", user.id)
      .single();

    if (error || !generation) {
      return NextResponse.json({ error: "This video can't be found." }, { status: 404 });
    }

    if (!PENDING.includes(generation.status)) {
      return NextResponse.json({ status: generation.status, generation });
    }

    let result;
    try {
      result = await getJobStatus(generation.model, requestId, !!generation.reference_image_url);
    } catch (err) {
      if (err instanceof RetryableFalError) {
        console.warn("fal.ai status check failed, will retry:", err.message);
        return NextResponse.json({ error: err.message, retryable: true }, { status: 502 });
      }
      throw err;
    }

    if (result.status === "COMPLETED" || result.status === "FAILED") {
      const { data: updated } = await supabase
        .from("generations")
        .update(
          result.status === "COMPLETED"
            ? { status: "completed", video_url: result.videoUrl, thumbnail_url: result.thumbnailUrl }
            : { status: "failed", error: result.error }
        )
        .eq("id", generation.id)
        // Don't overwrite a cancel that happened meanwhile.
        .in("status", PENDING)
        .select()
        .maybeSingle();
      return NextResponse.json({ status: updated?.status ?? generation.status, generation: updated ?? generation });
    }

    return NextResponse.json({ status: "processing", generation });
  } catch (err) {
    console.error("Status check crashed:", err);
    return NextResponse.json(
      { error: `Couldn't check on this video: ${(err as Error).message}`, retryable: true },
      { status: 500 }
    );
  }
}
