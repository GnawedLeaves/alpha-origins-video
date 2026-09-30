import "server-only";
import { fal } from "@fal-ai/client";
import { requireEnv } from "@/lib/env";
import { getFalModel, resolveFalEndpoint } from "./models";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  fal.config({ credentials: requireEnv("FAL_KEY", process.env.FAL_KEY) });
  configured = true;
}

export interface SubmitJobArgs {
  modelId: string;
  prompt: string;
  durationSeconds: number;
  referenceImageUrl?: string;
  webhookUrl?: string;
}

// Submits an async job to fal.ai's queue. If webhookUrl is provided (production, public URL),
// fal.ai will POST the result there when done; either way the returned request_id can be polled
// via getJobStatus.
export async function submitGenerationJob({
  modelId,
  prompt,
  durationSeconds,
  referenceImageUrl,
  webhookUrl,
}: SubmitJobArgs) {
  ensureConfigured();
  const model = getFalModel(modelId);

  const useImage = model.supportsImageToVideo && !!referenceImageUrl;
  if (model.requiresImage && !useImage) {
    throw new Error(`${model.label} needs a reference image`);
  }

  const input: Record<string, unknown> = {
    prompt,
    duration: String(durationSeconds),
  };
  if (useImage) {
    input.image_url = referenceImageUrl;
  }

  const { request_id } = await fal.queue.submit(resolveFalEndpoint(model, useImage), {
    input,
    webhookUrl,
  });

  return request_id;
}

export interface FalJobResult {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

export async function getJobStatus(
  modelId: string,
  requestId: string,
  hasReferenceImage: boolean
): Promise<FalJobResult> {
  ensureConfigured();
  const model = getFalModel(modelId);
  const endpoint = resolveFalEndpoint(model, model.supportsImageToVideo && hasReferenceImage);

  let status;
  try {
    status = await fal.queue.status(endpoint, { requestId, logs: false });
  } catch (err) {
    // fal.ai's client throws on a failed/cancelled job rather than returning a "FAILED" status.
    return { status: "FAILED", error: (err as Error).message };
  }

  if (status.status === "COMPLETED") {
    const result = await fal.queue.result(endpoint, { requestId });
    const output = result.data as { video?: { url?: string }; image?: { url?: string } };
    return {
      status: "COMPLETED",
      videoUrl: output.video?.url,
      thumbnailUrl: output.image?.url,
    };
  }

  if (status.status === "IN_PROGRESS") return { status: "IN_PROGRESS" };
  return { status: "IN_QUEUE" };
}

// Normalizes a fal.ai webhook payload (shape: { request_id, status, payload }) into the same
// result shape as getJobStatus, so the webhook and polling routes share update logic.
export function parseWebhookPayload(body: {
  status: string;
  payload?: { video?: { url?: string }; image?: { url?: string } };
  error?: string;
}): FalJobResult {
  if (body.status === "OK" || body.status === "COMPLETED") {
    return {
      status: "COMPLETED",
      videoUrl: body.payload?.video?.url,
      thumbnailUrl: body.payload?.image?.url,
    };
  }
  if (body.status === "ERROR") {
    return { status: "FAILED", error: body.error ?? "Generation failed" };
  }
  return { status: "IN_PROGRESS" };
}
