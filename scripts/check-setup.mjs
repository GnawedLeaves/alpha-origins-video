// Checks .env.local and the Supabase project are set up correctly. Run with `npm run check-setup`.
// Prints pass/fail per step and never prints key values, so the output is safe to share.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

let failures = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg, fix) => {
  failures++;
  console.log(`  ✗ ${msg}${fix ? `\n      → ${fix}` : ""}`);
};
const warn = (msg) => console.log(`  ! ${msg}`);

function checkVar(name, { required = true, validate } = {}) {
  const value = process.env[name];
  if (!value || value.startsWith("your-")) {
    if (required) fail(`${name} is not set`, "Fill it in in .env.local (see .env.local.example).");
    else warn(`${name} is not set (optional)`);
    return undefined;
  }
  if (value !== value.trim() || /["']/.test(value)) {
    warn(`${name} has stray spaces or quotes — double-check it`);
  }
  const problem = validate?.(value);
  if (problem) {
    fail(`${name} looks wrong: ${problem}`);
    return undefined;
  }
  ok(`${name} is set`);
  return value;
}

console.log("\n1. Environment variables (.env.local)");
const url = checkVar("NEXT_PUBLIC_SUPABASE_URL", {
  validate: (v) =>
    /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(v) || v.startsWith("http://127.0.0.1") || v.startsWith("http://localhost")
      ? undefined
      : "expected https://<project-ref>.supabase.co (Project Settings → API → Project URL), not the dashboard URL",
});
const anonKey = checkVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceKey = checkVar("SUPABASE_SERVICE_ROLE_KEY");
checkVar("FAL_KEY");
checkVar("GEMINI_API_KEY");
checkVar("FAL_WEBHOOK_SECRET", { required: false });
checkVar("NEXT_PUBLIC_SITE_URL", { required: false });
if (anonKey && serviceKey && anonKey === serviceKey) {
  fail("the anon key and service role key are identical", "Copy each from its own field in Project Settings → API.");
}

const base = url?.replace(/\/$/, "");

async function get(path, key) {
  const res = await fetch(`${base}${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  let body;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }
  return { status: res.status, body };
}

if (base && anonKey) {
  console.log("\n2. Supabase connection");
  try {
    const { status, body } = await get("/auth/v1/settings", anonKey);
    if (status === 200) {
      ok("reached Supabase Auth with the anon key");
      if (body?.disable_signup) {
        fail("sign-ups are disabled", "Supabase → Authentication → Sign In / Providers → allow new users to sign up.");
      } else ok("sign-ups are allowed");
      if (body?.external?.email === false) {
        fail("the Email provider is disabled", "Supabase → Authentication → Sign In / Providers → enable Email.");
      }
      if (body?.mailer_autoconfirm) {
        ok('"Confirm email" is off — new accounts can sign in immediately');
      } else {
        warn(
          '"Confirm email" is ON: after signing up you must click the emailed link before you can sign in.\n' +
            "      Supabase's built-in mailer only sends a few emails per hour. For local dev you can turn it off:\n" +
            '      Authentication → Sign In / Providers → Email → uncheck "Confirm email".'
        );
      }
    } else if (status === 401) {
      fail("Supabase rejected the anon key", "Re-copy NEXT_PUBLIC_SUPABASE_ANON_KEY from Project Settings → API.");
    } else {
      fail(`unexpected response from Supabase Auth (HTTP ${status})`);
    }
  } catch (err) {
    fail(`couldn't reach ${base} (${err.cause?.code ?? err.message})`, "Check NEXT_PUBLIC_SUPABASE_URL, and that the project isn't paused.");
  }
}

if (base && serviceKey) {
  console.log("\n3. Database tables (supabase/schema.sql)");
  try {
    for (const table of ["profiles", "projects", "generations", "exports", "captions"]) {
      const { status, body } = await get(`/rest/v1/${table}?select=id&limit=1`, serviceKey);
      if (status === 200) ok(`table "${table}" exists`);
      else if (status === 401 || status === 403) {
        fail(`service role key was rejected (HTTP ${status})`, "Re-copy SUPABASE_SERVICE_ROLE_KEY from Project Settings → API.");
        break;
      } else {
        fail(
          `table "${table}" is missing (HTTP ${status}${body?.message ? `: ${body.message}` : ""})`,
          "Run supabase/schema.sql, then supabase/policies.sql, in the Supabase SQL editor."
        );
      }
    }
    const { status } = await get("/storage/v1/bucket/exports", serviceKey);
    if (status === 200) ok('storage bucket "exports" exists');
    else fail('storage bucket "exports" is missing', "Run supabase/policies.sql in the SQL editor (it creates the buckets).");
  } catch (err) {
    fail(`couldn't query the database (${err.message})`);
  }
}

console.log(
  failures === 0
    ? "\nAll required checks passed. If you changed .env.local, restart `npm run dev`.\n"
    : `\n${failures} problem(s) found — fix them, then run this again.\n`
);
process.exit(failures === 0 ? 0 : 1);
