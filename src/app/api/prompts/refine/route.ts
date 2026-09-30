import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { refineVideoPrompt } from "@/lib/ai/refine-prompt";

const bodySchema = z.object({
  prompt: z.string().trim().min(2).max(2000),
  durationSeconds: z.number().int().positive(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
  hasReferenceImage: z.boolean(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Please type a few words first." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name")
    .eq("id", user.id)
    .single();

  try {
    const prompt = await refineVideoPrompt({
      idea: parsed.data.prompt,
      businessName: profile?.business_name || "Alpha Origins",
      durationSeconds: parsed.data.durationSeconds,
      aspectRatio: parsed.data.aspectRatio,
      hasReferenceImage: parsed.data.hasReferenceImage,
    });
    return NextResponse.json({ prompt });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
