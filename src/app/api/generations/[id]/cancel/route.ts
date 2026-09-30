import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cancelJob } from "@/lib/fal/client";
import { CANCELLED_ERROR, type GenerationStatus } from "@/lib/types/domain";

const PENDING: GenerationStatus[] = ["queued", "processing"];

// Stops a video that's still being made. The generation is marked cancelled even if fal.ai can't
// stop the job anymore (it may have already started), so the app stops waiting for it.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const { data: generation } = await supabase
    .from("generations")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!generation) {
    return NextResponse.json({ error: "This video can't be found." }, { status: 404 });
  }
  if (!PENDING.includes(generation.status)) {
    return NextResponse.json({ generation });
  }

  let stoppedAtFal = false;
  if (generation.fal_request_id) {
    try {
      stoppedAtFal = await cancelJob(
        generation.model,
        generation.fal_request_id,
        !!generation.reference_image_url
      );
    } catch (err) {
      console.warn("Couldn't ask fal.ai to cancel:", err);
    }
  }

  const { data: updated } = await supabase
    .from("generations")
    .update({ status: "failed", error: CANCELLED_ERROR })
    .eq("id", generation.id)
    .in("status", PENDING)
    .select()
    .maybeSingle();

  return NextResponse.json({ generation: updated ?? generation, stoppedAtFal });
}
