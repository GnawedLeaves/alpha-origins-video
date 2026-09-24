import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateCaptions } from "@/lib/ai/captions";
import type { Platform } from "@/lib/types/domain";

const bodySchema = z.object({
  projectId: z.string().uuid(),
  exportId: z.string().uuid().optional(),
  videoContext: z.string().min(3).max(4000),
  platforms: z
    .array(z.enum(["instagram_reels", "facebook_ads", "tiktok", "youtube_shorts"]))
    .min(1),
});

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
  const { projectId, exportId, videoContext, platforms } = parsed.data;

  const { data: profile } = await supabase
    .from("profiles")
    .select("brand_voice")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  let results;
  try {
    results = await generateCaptions({
      platforms: platforms as Platform[],
      videoContext,
      brandVoice: profile.brand_voice,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Caption generation failed: ${(err as Error).message}` },
      { status: 502 }
    );
  }

  const rows = results.map((r) => ({
    project_id: projectId,
    export_id: exportId ?? null,
    platform: r.platform,
    content: r.content,
    hashtags: r.hashtags,
    brand_voice_snapshot: profile.brand_voice,
  }));

  const { data: saved, error: insertError } = await supabase
    .from("captions")
    .insert(rows)
    .select();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ captions: saved });
}
