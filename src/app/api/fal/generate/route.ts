import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { describeFalError, submitGenerationJob } from "@/lib/fal/client";
import { getFalModel, maxImagesFor } from "@/lib/fal/models";
import { signGenerationId } from "@/lib/fal/webhook-token";

const bodySchema = z.object({
  projectId: z.string().uuid(),
  prompt: z.string().min(3).max(2000),
  modelId: z.string(),
  durationSeconds: z.number().int().positive(),
  referenceImageUrls: z.array(z.string().url()).max(7).optional(),
  // Older clients sent a single photo.
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
  const { projectId, prompt, modelId, durationSeconds, aspectRatio } = parsed.data;
  const referenceImageUrls =
    parsed.data.referenceImageUrls ??
    (parsed.data.referenceImageUrl ? [parsed.data.referenceImageUrl] : []);

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
  if (model.requiresImage && referenceImageUrls.length === 0) {
    return NextResponse.json({ error: `${model.label} needs a photo` }, { status: 400 });
  }
  if (referenceImageUrls.length > maxImagesFor(model)) {
    return NextResponse.json(
      { error: `${model.label} takes at most ${maxImagesFor(model)} photo(s)` },
      { status: 400 }
    );
  }

  const { data: generation, error: insertError } = await supabase
    .from("generations")
    .insert({
      project_id: projectId,
      owner_id: user.id,
      prompt,
      model: modelId,
      duration_seconds: durationSeconds,
      // Only the first photo is stored; it's used to pick the endpoint when polling status.
      reference_image_url: referenceImageUrls[0] ?? null,
      status: "queued",
    })
    .select()
    .single();

  if (insertError || !generation) {
    return NextResponse.json({ error: insertError?.message ?? "Insert failed" }, { status: 500 });
  }

  try {
    // fal.ai can only call back a public URL; on a local machine the client polls instead.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const webhookUrl =
      siteUrl && !isLocalUrl(siteUrl)
        ? `${siteUrl}/api/fal/webhook?generationId=${generation.id}&token=${signGenerationId(generation.id)}`
        : undefined;

    const requestId = await submitGenerationJob({
      modelId,
      prompt,
      durationSeconds,
      referenceImageUrls,
      aspectRatio,
      webhookUrl,
    });

    await supabase
      .from("generations")
      .update({ fal_request_id: requestId, status: "processing" })
      .eq("id", generation.id);

    return NextResponse.json({ generationId: generation.id, falRequestId: requestId });
  } catch (err) {
    console.error("fal.ai submit failed:", err);
    const message = describeFalError(err);
    await supabase
      .from("generations")
      .update({ status: "failed", error: message })
      .eq("id", generation.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function isLocalUrl(url: string) {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "localhost" ||
      hostname.endsWith(".local") ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    );
  } catch {
    return true;
  }
}
