import "server-only";
import { ApiError, ValidationError, fal } from "@fal-ai/client";
import { requireEnv } from "@/lib/env";
import type { AspectRatio } from "@/lib/types/domain";
import { getFalModel, maxImagesFor, resolveFalEndpoint } from "./models";

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
  referenceImageUrls?: string[];
  aspectRatio?: AspectRatio;
  webhookUrl?: string;
}

// Submits an async job to fal.ai's queue. If webhookUrl is provided (production, public URL),
// fal.ai will POST the result there when done; either way the returned request_id can be polled
// via getJobStatus.
export async function submitGenerationJob({
  modelId,
  prompt,
  durationSeconds,
  referenceImageUrls = [],
  aspectRatio,
  webhookUrl,
}: SubmitJobArgs) {
  ensureConfigured();
  const model = getFalModel(modelId);

  const images = referenceImageUrls.slice(0, maxImagesFor(model));
  const useImage = images.length > 0;
  if (model.requiresImage && !useImage) {
    throw new Error(`${model.label} needs a reference image`);
  }

  const input: Record<string, unknown> = {
    prompt,
    duration: String(durationSeconds),
  };
  if (useImage && (model.maxImages ?? 1) > 1) {
    input.image_urls = images;
    input.prompt = withImageReferences(prompt, images.length);
  } else if (useImage) {
    input.image_url = images[0];
  }
  if (aspectRatio && model.aspectRatios?.includes(aspectRatio)) {
    input.aspect_ratio = aspectRatio;
  }

  const { request_id } = await fal.queue.submit(resolveFalEndpoint(model, useImage), {
    input,
    webhookUrl,
  });

  return request_id;
}

// Multi-photo models only use a photo the prompt mentions as @Image1, @Image2… If the prompt
// doesn't mention any (e.g. it wasn't run through "Improve"), point at all of them.
export function withImageReferences(prompt: string, count: number) {
  if (/@Image\d/.test(prompt)) return prompt;
  const refs = Array.from({ length: count }, (_, i) => `@Image${i + 1}`).join(", ");
  return `${prompt.trim()} Use the reference photos ${refs} for how the dog, food and setting look.`;
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

// fal.ai's raw errors are "ApiError"s with the useful part in `body.detail`. Turn them into one
// sentence that says what to fix (shown to the user and saved on the generation row).
export function describeFalError(err: unknown): string {
  if (err instanceof ValidationError) {
    const fields = err.fieldErrors
      .map((e) => `${e.loc.filter((l) => l !== "body").join(".")}: ${e.msg}`)
      .join("; ");
    return `fal.ai didn't accept the request${fields ? ` (${fields})` : ""}.`;
  }
  if (err instanceof ApiError) {
    const body = err.body as { detail?: unknown } | undefined;
    const detail =
      typeof body?.detail === "string"
        ? body.detail
        : Array.isArray(body?.detail)
          ? body.detail.map((d: { msg?: string }) => d?.msg).filter(Boolean).join("; ")
          : err.message;
    const lower = detail.toLowerCase();
    if (err.status === 401) {
      return "fal.ai rejected FAL_KEY. Check the key in .env.local (format key_id:key_secret) and restart the app.";
    }
    if (err.status === 403 && (lower.includes("balance") || lower.includes("locked"))) {
      return "Your fal.ai account is out of credit. Add credit at fal.ai/dashboard/billing, then try again.";
    }
    if (err.status === 403) {
      return `fal.ai refused the request: ${detail}`;
    }
    if (err.status === 404) {
      return "fal.ai couldn't find this video model. Pick another style under \"More settings\".";
    }
    if (err.status === 429) {
      return "fal.ai is busy with too many requests. Please wait a minute and try again.";
    }
    return `fal.ai error (${err.status}): ${detail}`;
  }
  return err instanceof Error ? err.message : "Couldn't reach fal.ai. Please try again.";
}
