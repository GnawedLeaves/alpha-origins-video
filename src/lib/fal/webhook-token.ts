import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { requireEnv } from "@/lib/env";

// The webhook route runs with the service-role key and no user session, so it must not trust a
// bare generationId from the query string. We sign the id into the callback URL we hand to fal.ai
// and reject any request whose token doesn't match.
function secret() {
  return requireEnv("FAL_WEBHOOK_SECRET", process.env.FAL_WEBHOOK_SECRET);
}

export function signGenerationId(generationId: string) {
  return createHmac("sha256", secret()).update(generationId).digest("hex");
}

export function verifyGenerationToken(generationId: string, token: string) {
  const expected = Buffer.from(signGenerationId(generationId), "hex");
  const actual = Buffer.from(token, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
