import "server-only";
import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { requireEnv } from "@/lib/env";

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

// Gemini accepts a subset of JSON Schema; drop the `$schema` meta key zod adds.
function toGeminiSchema(schema: z.ZodType) {
  const json: Record<string, unknown> = z.toJSONSchema(schema);
  delete json.$schema;
  return json;
}

// One Gemini call that must return JSON matching `schema`. Errors are phrased for the end user.
export async function generateJson<T extends z.ZodType>({
  schema,
  system,
  user,
}: {
  schema: T;
  system: string;
  user: string;
}): Promise<z.infer<T>> {
  let text: string | undefined;
  try {
    const response = await gemini().models.generateContent({
      model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
      contents: user,
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        responseJsonSchema: toGeminiSchema(schema),
      },
    });
    text = response.text;
  } catch (err) {
    if (err instanceof ApiError && err.status === 429) {
      throw new Error("The AI is busy right now (free-tier limit). Please wait a minute and try again.");
    }
    throw err;
  }

  if (!text) throw new Error("The AI didn't send anything back. Please try again.");

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("The AI sent back something unreadable. Please try again.");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new Error("The AI sent back an unexpected answer. Please try again.");
  return parsed.data;
}
