// These are plain `type` object literals (not `interface`s) on purpose: TypeScript only lets a
// type satisfy an implicit string index signature (as required by supabase-js's `Record<string,
// unknown>` Row/Insert/Update constraints in src/lib/types/database.ts) when it's declared as a
// type literal. An equivalent `interface` fails that check silently and the whole Database
// generic collapses to `never`.

export type GenerationStatus = "queued" | "processing" | "completed" | "failed";

// A cancelled generation is stored as status "failed" with this error text (the status enum in
// supabase/schema.sql has no "cancelled", and this avoids a migration).
export const CANCELLED_ERROR = "Cancelled";

export function isCancelled(g: { status: GenerationStatus; error: string | null }) {
  return g.status === "failed" && g.error === CANCELLED_ERROR;
}

export type AspectRatio = "16:9" | "9:16" | "1:1";

export const ASPECT_RATIO_LABELS: Record<AspectRatio, string> = {
  "9:16": "Tall (phones)",
  "16:9": "Wide",
  "1:1": "Square",
};

export type Platform =
  | "instagram_reels"
  | "facebook_ads"
  | "tiktok"
  | "youtube_shorts";

export type BrandVoice = {
  tone: string;
  pillars: string[];
  avoid: string[];
  default_hashtags: string[];
  default_cta: string;
};

export type Profile = {
  id: string;
  business_name: string;
  brand_voice: BrandVoice;
  created_at: string;
};

export type Project = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Generation = {
  id: string;
  project_id: string;
  owner_id: string;
  prompt: string;
  model: string;
  duration_seconds: number;
  reference_image_url: string | null;
  fal_request_id: string | null;
  status: GenerationStatus;
  video_url: string | null;
  thumbnail_url: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type Clip = {
  id: string;
  project_id: string;
  generation_id: string | null;
  source_url: string;
  trim_start: number;
  trim_end: number | null;
  order_index: number;
  created_at: string;
};

export type ExportRecord = {
  id: string;
  project_id: string;
  owner_id: string;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  clip_ids: string[];
  created_at: string;
};

export type CaptionRecord = {
  id: string;
  project_id: string;
  export_id: string | null;
  platform: Platform;
  content: string;
  hashtags: string[];
  brand_voice_snapshot: BrandVoice | null;
  created_at: string;
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram_reels: "Instagram Reels",
  facebook_ads: "Facebook Ads",
  tiktok: "TikTok",
  youtube_shorts: "YouTube Shorts",
};
