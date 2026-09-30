import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { requireEnv } from "@/lib/env";
import type { BrandVoice, Platform } from "@/lib/types/domain";

// Override with ANTHROPIC_MODEL in .env.local if you want a different model.
const DEFAULT_MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
function anthropic() {
  client ??= new Anthropic({
    apiKey: requireEnv("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY),
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

  const message = await anthropic().messages.parse({
    model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    max_tokens: 16000,
    output_config: { effort: "low", format: zodOutputFormat(CaptionsSchema) },
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  if (message.stop_reason === "refusal") {
    throw new Error("The caption generator declined this request — try rewording the video context");
  }
  if (!message.parsed_output) {
    throw new Error("Could not parse caption generator response");
  }

  const requested = new Set(platforms);
  return message.parsed_output.captions.filter((c) => requested.has(c.platform));
}
