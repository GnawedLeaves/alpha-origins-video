import "server-only";
import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { requireEnv } from "@/lib/env";
import type { BrandVoice, Platform } from "@/lib/types/domain";

// "gemini-flash-latest" always points at Google's current Flash model, which is on the Gemini API
// free tier. Override with GEMINI_MODEL in .env.local to pin a specific model.
const DEFAULT_MODEL = "gemini-flash-latest";

let client: GoogleGenAI | null = null;
function gemini() {
  client ??= new GoogleGenAI({
    apiKey: requireEnv("GEMINI_API_KEY", process.env.GEMINI_API_KEY),
  });
  return client;
}

const PLATFORMS = ["instagram_reels", "facebook_ads", "tiktok", "youtube_shorts"] as const;

const CaptionsSchema = z.object({
  captions: z.array(
    z.object({
      platform: z.enum(PLATFORMS),
      content: z.string(),
      hashtags: z.array(z.string()),
    })
  ),
});

// Gemini accepts a subset of JSON Schema; drop the `$schema` meta key zod adds.
const CAPTIONS_JSON_SCHEMA = (() => {
  const schema: Record<string, unknown> = z.toJSONSchema(CaptionsSchema);
  delete schema.$schema;
  return schema;
})();

const PLATFORM_SPEC: Record<Platform, string> = {
  instagram_reels:
    "Instagram Reels caption. 1-3 short punchy sentences plus a line break before hashtags. Max ~150 characters before hashtags. 5-8 relevant hashtags.",
  facebook_ads:
    "Facebook Ads primary text. Benefit-led opening line (first 125 chars matter most, shown before 'See more'), then 1-2 supporting sentences, then a clear CTA. 2-4 hashtags max, Facebook audiences respond less to hashtags.",
  tiktok:
    "TikTok caption. Casual, energetic, trend-aware voice. Very short (under 100 characters ideal). 3-5 hashtags mixing broad (#dogsoftiktok) and niche tags.",
  youtube_shorts:
    "YouTube Shorts title + description combo. First line is a punchy title-style hook (under 60 chars), then 1-2 sentence description, then a CTA to subscribe or shop. 3-5 hashtags.",
};

export interface CaptionResult {
  platform: Platform;
  content: string;
  hashtags: string[];
}

export async function generateCaptions({
  platforms,
  videoContext,
  brandVoice,
}: {
  platforms: Platform[];
  videoContext: string;
  brandVoice: BrandVoice;
}): Promise<CaptionResult[]> {
  const platformInstructions = platforms
    .map((p) => `- ${p}: ${PLATFORM_SPEC[p]}`)
    .join("\n");

  const systemPrompt = `You are a social media copywriter for a dog food brand. Write captions strictly in this brand voice:
- Tone: ${brandVoice.tone}
- Brand pillars to draw on: ${brandVoice.pillars.join(", ")}
- Avoid: ${brandVoice.avoid.join(", ")}
- Default CTA to adapt (don't repeat verbatim every time): "${brandVoice.default_cta}"
- Suggested hashtags to draw from (mix with more specific ones): ${brandVoice.default_hashtags.join(", ")}

Never make veterinary or medical claims (e.g. "cures", "treats disease"). Focus on real ingredients, nutrition, and happy dogs.

Return one entry in "captions" per requested platform. "content" must NOT include the hashtags inline — return them separately in "hashtags", each starting with "#".`;

  const userPrompt = `Video ad context: ${videoContext}

Generate one caption per platform below, following each platform's format exactly:
${platformInstructions}`;

  let text: string | undefined;
  try {
    const response = await gemini().models.generateContent({
      model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseJsonSchema: CAPTIONS_JSON_SCHEMA,
      },
    });
    text = response.text;
  } catch (err) {
    if (err instanceof ApiError && err.status === 429) {
      throw new Error("Gemini free-tier rate limit reached — wait a minute and try again");
    }
    throw err;
  }

  if (!text) {
    throw new Error("No response from caption generator");
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Could not parse caption generator response");
  }
  const parsed = CaptionsSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Caption generator returned an unexpected format");
  }

  const requested = new Set(platforms);
  return parsed.data.captions.filter((c) => requested.has(c.platform));
}
