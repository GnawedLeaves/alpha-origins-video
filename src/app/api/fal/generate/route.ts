import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { submitGenerationJob } from "@/lib/fal/client";
import { getFalModel } from "@/lib/fal/models";
import { signGenerationId } from "@/lib/fal/webhook-token";

const bodySchema = z.object({
  projectId: z.string().uuid(),
  prompt: z.string().min(3).max(2000),
  modelId: z.string(),
  durationSeconds: z.number().int().positive(),
  referenceImageUrl: z.string().url().optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
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
  const { projectId, prompt, modelId, durationSeconds, referenceImageUrl, aspectRatio } =
    parsed.data;

  let model;
  try {
    model = getFalModel(modelId);
  } catch {
    return NextResponse.json({ error: "Unknown model" }, { status: 400 });
  }
  if (!model.durations.includes(durationSeconds)) {
    return NextResponse.json({ error: "Unsupported duration for this model" }, { status: 400 });
  }
  if (aspectRatio && !model.aspectRatios?.includes(aspectRatio)) {
    return NextResponse.json(
      { error: `${model.label} doesn't support ${aspectRatio}` },
      { status: 400 }
    );
  }
  if (model.requiresImage && !referenceImageUrl) {
    return NextResponse.json({ error: `${model.label} needs a reference image` }, { status: 400 });
  }

  const { data: generation, error: insertError } = await supabase
    .from("generations")
    .insert({
      project_id: projectId,
      owner_id: user.id,
      prompt,
      model: modelId,
      duration_seconds: durationSeconds,
      reference_image_url: referenceImageUrl ?? null,
      status: "queued",
    })
    .select()
    .single();

  if (insertError || !generation) {
    return NextResponse.json({ error: insertError?.message ?? "Insert failed" }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const webhookUrl =
    siteUrl && !siteUrl.includes("localhost")
      ? `${siteUrl}/api/fal/webhook?generationId=${generation.id}&token=${signGenerationId(generation.id)}`
      : undefined;

  try {
    const requestId = await submitGenerationJob({
      modelId,
      prompt,
      durationSeconds,
      referenceImageUrl,
      aspectRatio,
      webhookUrl,
    });

    await supabase
      .from("generations")
      .update({ fal_request_id: requestId, status: "processing" })
      .eq("id", generation.id);

    return NextResponse.json({ generationId: generation.id, falRequestId: requestId });
  } catch (err) {
    await supabase
      .from("generations")
      .update({ status: "failed", error: (err as Error).message })
      .eq("id", generation.id);
    return NextResponse.json({ error: "Failed to submit job to fal.ai" }, { status: 502 });
  }
}
