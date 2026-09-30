// Central place for reading required env vars, so a missing key fails with a clear message naming
// the variable (and pointing at .env.local.example) instead of a cryptic SDK error.
//
// NEXT_PUBLIC_* values must be passed in as literal `process.env.NEXT_PUBLIC_X` expressions:
// Next.js only inlines them into the browser bundle when referenced statically, so they can't be
// looked up by name here (see node_modules/next/dist/docs/01-app/02-guides/environment-variables.md).

export function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.startsWith("your-")) {
    throw new Error(
      `Missing environment variable ${name}. Add it to .env.local (see .env.local.example) and restart the dev server.`
    );
  }
  return value;
}

export function supabaseUrl() {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseAnonKey() {
  return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
