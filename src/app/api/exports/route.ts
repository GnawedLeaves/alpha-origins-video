import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  projectId: z.string().uuid(),
  videoUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  durationSeconds: z.number().positive().optional(),
  clipIds: z.array(z.string().uuid()),
});

// Called after the browser has already rendered the merged video with ffmpeg-wasm and uploaded
// it to the `exports` Storage bucket. This just persists the resulting metadata row.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { projectId, videoUrl, thumbnailUrl, durationSeconds, clipIds } = parsed.data;

  const { data: exportRow, error } = await supabase
    .from("exports")
    .insert({
      project_id: projectId,
      owner_id: user.id,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl ?? null,
      duration_seconds: durationSeconds ?? null,
      clip_ids: clipIds,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ export: exportRow });
}
