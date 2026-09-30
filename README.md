# Alpha Origins

AI video ad studio for a dog food brand: generate short video ads with Fal.ai, trim/splice them
in-browser, generate platform-tailored captions, and export/share the result.

## Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Video editing**: `@ffmpeg/ffmpeg` (WASM) running entirely in the browser
- **Backend/DB**: Supabase (Auth, Postgres, Storage)
- **AI video**: `@fal-ai/client` (Kling, LTX Video, MiniMax — see `src/lib/fal/models.ts`)
- **AI captions**: `@anthropic-ai/sdk` (Claude), brand-voice aware, per-platform

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/schema.sql`, then `supabase/policies.sql`. This creates the
   tables, RLS policies, the `reference-images` (public) and `exports` (private) storage buckets,
   a trigger that auto-creates a `profiles` row on signup, and adds `generations` to the
   `supabase_realtime` publication for live status updates.
3. In **Authentication → Providers**, email/password is enabled by default — that's all this app
   uses. Turn off "Confirm email" while developing locally if you don't want to click email
   confirmation links.
4. Copy the Project URL, anon key, and service role key from **Project Settings → API**.

## 2. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in (every variable is also documented inline in `.env.local.example`; if one is missing, the
app throws an error naming it):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — from Supabase.
- `FAL_KEY` — from [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys).
- `FAL_WEBHOOK_SECRET` — any long random string (`openssl rand -hex 32`). The webhook callback URL
  is HMAC-signed with it so nobody else can post fake results. Only used when webhooks are on.
- `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com).
  `ANTHROPIC_MODEL` optionally overrides the caption model (default `claude-opus-5-5`).
- `NEXT_PUBLIC_SITE_URL` — `http://localhost:3000` for local dev. **fal.ai webhooks need a public
  URL**, so in local dev the app automatically falls back to polling (`/api/fal/status/...`)
  instead of registering a webhook whenever `NEXT_PUBLIC_SITE_URL` contains `localhost`. If you
  want to test the webhook path locally, run `ngrok http 3000` and set this to the ngrok URL.

## 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll land on `/login` — sign up, and you're
in.

## How it fits together

- **Generate tab** (`PromptComposer` + `GenerationList`): submits a prompt (+ optional reference
  image) to `/api/fal/generate`, which inserts a `generations` row and enqueues a fal.ai job.
  Status updates arrive via Supabase Realtime (webhook path) or a 4s poll fallback
  (`useGenerations`).
- **Editor tab** (`Timeline`): add completed generations to an in-memory timeline, trim/split/
  reorder clips, then "Trim, merge & export" runs `@ffmpeg/ffmpeg` in the browser to produce a
  single MP4, uploads it to the `exports` bucket, and saves the metadata via `/api/exports`.
- **Captions tab**: generates platform-specific captions (Instagram Reels, Facebook Ads, TikTok,
  YouTube Shorts) via `/api/captions/generate`, which calls Claude with your brand voice
  (editable in the same tab, persisted to `profiles.brand_voice`).
- **Share tab**: download the MP4, copy a caption to the clipboard, or use the native
  `navigator.share()` sheet on supported devices (mobile Safari/Chrome). There's no direct
  Instagram/Facebook posting in v1 — that requires a Meta Developer App, Business verification,
  and App Review for content-publishing permissions, which takes external approval you'd need to
  obtain separately. `ShareExportPanel` is where a `MetaPublisher` integration would plug in later.

## Adding a Fal.ai model

Add an entry to `FAL_MODELS` in `src/lib/fal/models.ts` — no other code changes needed as long as
the endpoint accepts `{ prompt, image_url?, duration }`-shaped input and returns
`{ video: { url } }`. If a model's schema differs, adjust `buildFalInput`/`parseFalOutput` logic in
`src/lib/fal/client.ts`.

## Deployment (Vercel)

1. Push to a Git repo, import into Vercel.
2. Set all `.env.local` variables as Vercel environment variables, with `NEXT_PUBLIC_SITE_URL` set
   to your production domain (this enables the fal.ai webhook path instead of polling).
3. In Supabase, add your production domain to **Authentication → URL Configuration → Redirect
   URLs**.

## Known limitations / next steps

- FFmpeg-wasm rendering happens on the visitor's device — fine for a handful of 5–10s clips, but
  large timelines will be slow/memory-heavy on low-end phones. If that becomes a problem, move
  rendering to a server route/queue (ffmpeg binary + job worker) — the `Timeline` component's
  `handleExport` is the single place that would need to call a new `/api/exports/render` route
  instead of `useFfmpeg` directly.
- No direct Meta (Instagram/Facebook) publishing yet — see above.
- Caption generation and brand voice are dog-food-specific by default (`supabase/schema.sql`'s
  `profiles.brand_voice` default and the system prompt in `src/lib/ai/captions.ts`); adjust both
  if the brand voice needs to change.
