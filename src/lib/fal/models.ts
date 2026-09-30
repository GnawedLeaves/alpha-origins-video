import type { AspectRatio } from "@/lib/types/domain";

export interface FalModel {
  id: string;
  falEndpoint: string;
  label: string;
  description: string;
  supportsImageToVideo: boolean;
  // Image-to-video endpoints reject requests without an image_url.
  requiresImage?: boolean;
  // Some models expose image-to-video as a separate endpoint; used when a reference image is sent.
  imageToVideoEndpoint?: string;
  durations: number[];
  // How many reference photos the model takes (default 1 for image-to-video models). Models with
  // more than one receive them as `image_urls` and refer to them in the prompt as @Image1, @Image2…
  maxImages?: number;
  // Aspect ratios the endpoint accepts via `aspect_ratio`. Omitted = no aspect control: image-to-
  // video output follows the reference image's shape, text-to-video output is fixed landscape.
  aspectRatios?: AspectRatio[];
}

// Small, easy-to-extend registry. Add a new model by adding an entry here — no other code
// changes needed as long as the fal.ai endpoint accepts { prompt, image_url?, duration }-shaped
// input and returns { video: { url } } on completion (adjust buildFalInput/parseFalOutput in
// src/lib/fal/client.ts if a model's schema differs).
export const FAL_MODELS: FalModel[] = [
  {
    id: "kling-2.0",
    falEndpoint: "fal-ai/kling-video/v2/master/text-to-video",
    label: "Kling 2.0 (text-to-video)",
    description: "High fidelity, best for polished hero shots from a text prompt.",
    supportsImageToVideo: false,
    durations: [5, 10],
    aspectRatios: ["9:16", "16:9", "1:1"],
  },
  {
    id: "kling-2.0-image",
    falEndpoint: "fal-ai/kling-video/v2/master/image-to-video",
    label: "Kling 2.0 (image-to-video)",
    description: "Animate a product photo or dog photo you upload (image required).",
    supportsImageToVideo: true,
    requiresImage: true,
    durations: [5, 10],
  },
  {
    id: "ltx-video",
    falEndpoint: "fal-ai/ltx-video",
    imageToVideoEndpoint: "fal-ai/ltx-video/image-to-video",
    label: "LTX Video (fast)",
    description: "Fast and cheap — good for quick iteration on a concept.",
    supportsImageToVideo: true,
    durations: [5],
  },
  {
    id: "minimax-hailuo",
    falEndpoint: "fal-ai/minimax/video-01/image-to-video",
    label: "MiniMax Hailuo (image-to-video)",
    description: "Smooth motion, strong at bringing a still product shot to life (image required).",
    supportsImageToVideo: true,
    requiresImage: true,
    durations: [6],
  },
  {
    id: "kling-o1-reference",
    falEndpoint: "fal-ai/kling-video/o1/standard/reference-to-video",
    label: "Kling O1 (several photos)",
    description: "Combines up to 7 photos (e.g. your dog and the food bag) into one video.",
    supportsImageToVideo: true,
    requiresImage: true,
    maxImages: 7,
    durations: [5, 10],
    aspectRatios: ["9:16", "16:9", "1:1"],
  },
  {
    id: "kling-o1-reference-pro",
    falEndpoint: "fal-ai/kling-video/o1/reference-to-video",
    label: "Kling O1 Pro (several photos)",
    description: "Like Kling O1, with higher quality. Costs more per video.",
    supportsImageToVideo: true,
    requiresImage: true,
    maxImages: 7,
    durations: [5, 10],
    aspectRatios: ["9:16", "16:9", "1:1"],
  },
];

export function maxImagesFor(model: FalModel) {
  return model.supportsImageToVideo ? (model.maxImages ?? 1) : 0;
}

// The endpoint a job was actually submitted to. Status/result lookups must hit the same endpoint,
// so this is derived the same way at submit time and at poll time.
export function resolveFalEndpoint(model: FalModel, hasReferenceImage: boolean) {
  return hasReferenceImage && model.imageToVideoEndpoint
    ? model.imageToVideoEndpoint
    : model.falEndpoint;
}

export function getFalModel(id: string): FalModel {
  const model = FAL_MODELS.find((m) => m.id === id);
  if (!model) throw new Error(`Unknown model id: ${id}`);
  return model;
}
