import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { BrandVoice, Platform } from "@/lib/types/domain";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

Respond with ONLY a JSON array, no prose, no markdown fences. Each element: { "platform": string, "content": string, "hashtags": string[] }. "content" must NOT include the hashtags inline — return them separately in "hashtags".`;

  const userPrompt = `Video ad context: ${videoContext}

Generate one caption per platform below, following each platform's format exactly:
${platformInstructions}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from caption generator");
  }

  const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Could not parse caption generator response");
  }

  const parsed = JSON.parse(jsonMatch[0]) as CaptionResult[];
  return parsed;
}
