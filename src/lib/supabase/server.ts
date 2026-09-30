import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { requireEnv, supabaseAnonKey, supabaseUrl } from "@/lib/env";

// Use inside Server Components / Route Handlers / Server Actions. Reads and (where possible)
// refreshes the user's session from cookies.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    supabaseUrl(),
    supabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no response to attach cookies to.
            // Safe to ignore as long as middleware.ts is refreshing sessions.
          }
        },
      },
    }
  );
}

// Service-role client for trusted server-only code paths that run without a user session
// (the fal.ai webhook). Never import this into client components or expose the key.
export function createServiceRoleClient() {
  return createSupabaseClient<Database>(
    supabaseUrl(),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
