import "server-only";
import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { requireEnv } from "@/lib/env";

// "gemini-flash-latest" always points at Google's current Flash model, which is on the Gemini API
// free tier. Override with GEMINI_MODEL in .env.local to pin a specific model.
const DEFAULT_MODEL = "gemini-flash-latest";
// Used when the main model is overloaded or rate-limited. Also free tier, with its own quota.
const DEFAULT_FALLBACK_MODEL = "gemini-flash-lite-latest";

// 500/503/504: Google-side overload or hiccup, usually gone within seconds.
const RETRYABLE = new Set([500, 503, 504]);
const RETRY_DELAYS_MS = [1000, 2500];

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
  const primary = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const fallback = process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;
  const models = fallback && fallback !== primary ? [primary, fallback] : [primary];

  let text: string | undefined;
  // First error per model; reported from the main model unless only the fallback says why.
  const errors: { model: string; err: unknown }[] = [];
  outer: for (const model of models) {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const response = await gemini().models.generateContent({
          model,
          contents: user,
          config: {
            systemInstruction: system,
            responseMimeType: "application/json",
            responseJsonSchema: toGeminiSchema(schema),
          },
        });
        text = response.text;
        break outer;
      } catch (err) {
        if (!errors.some((e) => e.model === model)) errors.push({ model, err });
        const status = err instanceof ApiError ? err.status : undefined;
        console.error(`Gemini ${model} failed (attempt ${attempt + 1}, status ${status ?? "?"})`);
        if (status !== undefined && RETRYABLE.has(status) && attempt < RETRY_DELAYS_MS.length) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
          continue;
        }
        // Overloaded, rate-limited or missing: try the fallback model. Anything else (bad key,
        // bad request) would fail the same way on every model.
        if (status !== undefined && (RETRYABLE.has(status) || status === 429 || status === 404)) {
          continue outer;
        }
        break outer;
      }
    }
  }

  if (text === undefined && errors.length) {
    // A missing fallback model (404) isn't the interesting failure; the main model's error is.
    const reported = errors.find((e) => !(e.err instanceof ApiError && e.err.status === 404)) ?? errors[0];
    throw new Error(describeGeminiError(reported.err, reported.model));
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

function describeGeminiError(err: unknown, model: string): string {
  if (!(err instanceof ApiError)) {
    return err instanceof Error ? err.message : "The AI couldn't be reached. Please try again.";
  }
  const raw = err.message.toLowerCase();
  if (RETRYABLE.has(err.status)) {
    return "Google's free AI is very busy right now. Please wait a minute and try again.";
  }
  if (err.status === 429) {
    return "The free AI limit was reached. Please wait a minute and try again.";
  }
  if (err.status === 400 && raw.includes("api key")) {
    return "Google rejected GEMINI_API_KEY. Check it in .env.local and restart the app.";
  }
  if (err.status === 403) {
    return "GEMINI_API_KEY isn't allowed to use Gemini. Create a new key at aistudio.google.com/apikey.";
  }
  if (err.status === 404) {
    return `The Gemini model "${model}" isn't available. Set GEMINI_MODEL in .env.local to one that is.`;
  }
  return `The AI returned an error (${err.status}). Please try again.`;
}
