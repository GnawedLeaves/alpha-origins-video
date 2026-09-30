import "server-only";
import { z } from "zod";
import { generateJson } from "@/lib/ai/gemini";
import type { AspectRatio } from "@/lib/types/domain";

const RefinedSchema = z.object({ prompt: z.string().min(1) });

const FRAMING: Record<AspectRatio, string> = {
  "9:16": "vertical 9:16 phone video: keep the main subject centered and fully in frame top to bottom",
  "16:9": "horizontal 16:9 video",
  "1:1": "square 1:1 video: keep the main subject centered",
};

// Turns a short, plain-language idea (typed by someone who isn't a prompt expert) into a detailed
// prompt that text/image-to-video models respond well to.
export async function refineVideoPrompt({
  idea,
  businessName,
  durationSeconds,
  aspectRatio,
  hasReferenceImage,
}: {
  idea: string;
  businessName: string;
  durationSeconds: number;
  aspectRatio?: AspectRatio;
  hasReferenceImage: boolean;
}): Promise<string> {
  const system = `You write prompts for an AI video generator. The videos are short social media ads for ${businessName}, a dog food brand. The person describing the idea is not technical, so their description may be short, vague, or in another language.

Rewrite their idea into ONE prompt that will produce the best possible video. Rules:
- Keep their idea. Keep every specific detail they gave (dog breed, number of dogs, food, place, time of day, mood). Don't add new story elements they wouldn't expect.
- The clip is only ${durationSeconds} seconds long and is one continuous shot: describe one simple, clear action (at most two), no scene changes or cuts.
- Be concrete and visual: the subject and what it does, the setting, the lighting, the camera (shot type such as close-up or medium shot, and a gentle movement such as a slow push-in or tracking shot), and the mood.
- Make it look like a warm, bright, high-quality commercial: natural light, realistic, shallow depth of field, happy healthy dogs.
- Never ask for on-screen text, captions, words, logos or labels — AI video can't render text. If a food bag or packaging appears, describe it simply without any readable text.
- No medical or health claims, nothing unsafe for dogs, no distressed animals.
- ${
    hasReferenceImage
      ? "The video will animate a photo the person uploaded. You can't see it. Describe only the motion, camera movement and mood — do not describe or change what the photo shows (breeds, colors, background, objects)."
      : "Describe the full scene, since there is no photo."
  }
${aspectRatio ? `- Framing: ${FRAMING[aspectRatio]}.\n` : ""}- Write in English, whatever language the idea was written in.
- 40 to 90 words, one paragraph, plain sentences. No quotes, lists, headings or markdown.

Respond with JSON: {"prompt": "<the rewritten prompt>"}.`;

  const result = await generateJson({
    schema: RefinedSchema,
    system,
    user: `The idea: ${idea}`,
  });
  return result.prompt.trim();
}
