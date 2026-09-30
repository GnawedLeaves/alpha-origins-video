# Keemu

*(temporary name)* A simple video ad maker for **Alpha Origins**, a dog food company. It's built to
be used by someone who isn't technical: describe the video in plain words, press **Improve my
description** to have AI turn that into a detailed prompt, press **Enter** (or **Make video**), then
put clips together, get captions and share.

The screens are deliberately simple: numbered steps, large text and buttons, plain language, and
the AI model is picked automatically (a photo switches to the photo model). Technical settings are
under "More settings".

## Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Video editing**: `@ffmpeg/ffmpeg` (WASM) running entirely in the browser
- **Backend/DB**: Supabase (Auth, Postgres, Storage)
- **AI video**: `@fal-ai/client` (Kling, LTX Video, MiniMax — see `src/lib/fal/models.ts`)
- **AI captions**: `@google/genai` (Gemini, free tier), brand-voice aware, per-platform

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
- `GEMINI_API_KEY` — free from [Google AI Studio](https://aistudio.google.com/apikey).
  `GEMINI_MODEL` optionally overrides the caption model (default `gemini-flash-latest`, which is on
  the free tier; free-tier keys are rate-limited, so rapid repeated caption requests may get a
  "rate limit reached" error).
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

## Troubleshooting sign-up / login

Run this first. It checks `.env.local`, your Supabase keys, tables and auth settings, and prints
what to fix (it never prints key values):

```bash
npm run check-setup
```

- **Changed `.env.local`?** Stop and restart `npm run dev`. Env vars are only read at startup.
- **"Check your email for a confirmation link"**: Supabase's "Confirm email" setting is on (the
  default). Click the link in the email, then sign in. For local development it's easier to turn it
  off: **Authentication → Sign In / Providers → Email → uncheck "Confirm email"**.
- **No confirmation email arrived / "email rate limit exceeded"**: Supabase's built-in mailer sends
  only a few emails per hour and often lands in spam. Turn off "Confirm email" (above), or confirm
  the user by hand in **Authentication → Users**.
- **"Database error saving new user"**: the tables or signup trigger are missing. Run
  `supabase/schema.sql`, then `supabase/policies.sql`, in the SQL editor.
- **"Invalid API key" / "Couldn't reach Supabase"**: re-copy the Project URL and anon key from
  **Project Settings → API**. The URL looks like `https://<project-ref>.supabase.co`.
- **Confirmation link opens a broken page**: in **Authentication → URL Configuration**, set Site URL
  to `http://localhost:3000` (and your production domain when you deploy).

## Troubleshooting AI errors

- **"Google's free AI is very busy right now"**: Gemini's free tier returns 503 "high demand" at
  busy times. Keemu retries twice and then falls back to `gemini-flash-lite-latest`
  (`GEMINI_FALLBACK_MODEL`); if both are busy, wait a minute and try again.
- **A clip fails straight away**: open "What went wrong?" under the clip, or read the red message.
  The real fal.ai reason is shown, e.g. a rejected `FAL_KEY` (it's `key_id:key_secret`), an account
  with no credit (new fal.ai accounts need credit added at fal.ai/dashboard/billing), or a photo fal
  couldn't use. The full error is also printed in the `npm run dev` terminal.

## Usage & cost page

Each project has a **Usage & cost** page (`/projects/[id]/usage`, button in the project header):
totals (estimated fal.ai cost, videos made, seconds, final videos, captions), estimated cost per day
for the last 30 days, a breakdown by video style, and the full generation history.

Costs are **estimates**: finished videos × each style's price. Prices come from fal.ai's pricing API
(`api.fal.ai/v1/models/pricing`, looked up with `FAL_KEY` and cached for an hour) when it answers,
otherwise from the built-in list in `src/lib/fal/pricing.ts`. **Update that list** from fal.ai's
model pages: the built-in numbers drift, and the Kling O1 models have no price set there, so they
show as "no price set" unless fal's API supplies one. Failed videos count as $0. The exact bill is
in the fal.ai dashboard.

## Loading feedback

Route changes show instant skeletons (`loading.tsx` in `dashboard/`, `projects/[id]/` and
`projects/[id]/usage/`); project cards show "Opening…" and link buttons show a spinner while the
next page loads. `Button` takes `loading` (spinner, disabled, `aria-busy`); buttons that navigate
keep spinning until the new page is ready (`useTransition` around `router.push`). The main action
of a screen uses `variant="cta"` (terracotta).

## When a video gets stuck

- The page checks each unfinished video every few seconds, backing off when a check fails. After
  3 failed checks in a row the card says **"We couldn't check on this video"** with the reason and a
  **Try again** button, and stops checking until pressed. A job fal.ai reports as failed shows
  "Didn't work" with the reason under "What went wrong?" (fal marks failed jobs COMPLETED and only
  returns the error when the result is fetched; `getJobStatus` handles this).
- **Cancel** (on unfinished videos) asks fal.ai to stop the job (`/api/generations/[id]/cancel`)
  and marks it cancelled (stored as status `failed` with error `Cancelled`, so no migration is
  needed). fal can only stop jobs still waiting in its queue; one that already started may finish
  and be billed, but it won't be shown. Failed/cancelled cards can be **Removed**.

## How it fits together

- **Improve my description** (`PromptComposer` → `/api/prompts/refine` → `src/lib/ai/refine-prompt.ts`):
  Gemini rewrites a short idea into a detailed video prompt (one continuous shot sized to the clip
  length, camera/lighting/mood, no on-screen text, motion-only when a photo is attached). Inputs are
  locked while it runs; the cursor returns to the box so Enter sends it. Undo restores the original.
- **My photos album** (`PhotoAlbum`, `src/lib/album.ts`): "Add a photo" opens the album. New photos
  are shrunk in the browser (max 1920px JPEG) and saved straight away to the user's folder in the
  `reference-images` bucket, so they can be picked again for later videos without re-uploading. The
  album is just a listing of that folder — no extra table. Removing a photo deletes it from storage;
  videos already made with it are unaffected. Picking a photo switches to the image-to-video model.
- **1. Make clips** (`PromptComposer` + `GenerationList`): submits a prompt (+ optional reference
  image) to `/api/fal/generate`, which inserts a `generations` row and enqueues a fal.ai job.
  Status updates arrive via Supabase Realtime (webhook path) or a 4s poll fallback
  (`useGenerations`).
- **Watching clips**: tapping a finished clip's thumbnail opens `ClipViewer` (full-size player,
  "Use this clip", "Download clip").
- **2. Put together** is a timeline editor (`Timeline`, `TimelineTracks`, `useTimelinePlayback`):
  a preview player and a ruler/playhead over a video track and a music track. Drag clip blocks to
  reorder; tap one to trim it, "Cut here" at the paused spot, duplicate or delete it (`ClipTrimmer`).
  "Add music" puts a song on the music track: drag it to set where it starts, and set the start
  point in the song, volume and fade-out in `MusicPanel`. Preview plays video and music in sync;
  `useFfmpeg` mixes the music into the export (same fades as the preview, `timeline-model.ts`).
  Music stays in the browser (it isn't uploaded) and, like the timeline, is lost on reload.
- **Downloads / ffmpeg input** go through `/api/media` (`src/app/api/media/route.ts`), a signed-in,
  same-origin pass-through limited to fal.ai media and this project's Supabase storage. Browsers
  ignore `<a download>` on cross-origin URLs, and ffmpeg-wasm needs CORS to read clip bytes.
- **2. Put together** (`Timeline`): add completed generations to an in-memory timeline, arrange
  them and add music, then "Make final video" runs `@ffmpeg/ffmpeg` in the browser to produce a
  single MP4, uploads it to the `exports` bucket, and saves the metadata via `/api/exports`.
- **3. Captions**: generates platform-specific captions (Instagram Reels, Facebook Ads, TikTok,
  YouTube Shorts) via `/api/captions/generate`, which calls Gemini with your brand voice
  (editable in the same tab, persisted to `profiles.brand_voice`).
- **4. Share**: download the MP4, copy a caption to the clipboard, or use the native
  `navigator.share()` sheet on supported devices (mobile Safari/Chrome). There's no direct
  Instagram/Facebook posting in v1 — that requires a Meta Developer App, Business verification,
  and App Review for content-publishing permissions, which takes external approval you'd need to
  obtain separately. `ShareExportPanel` is where a `MetaPublisher` integration would plug in later.

## Several photos in one video

Picking 2 or more photos in "My photos" switches to **Kling O1 reference-to-video**
(`kling-o1-reference`, standard; the Pro version is under "More settings"). It takes up to 7
photos (e.g. the dog, the food bag, a place) and refers to them in the prompt as `@Image1`,
`@Image2`… in pick order. "Improve my description" writes those tags in; if a prompt has none,
the server appends a line referencing every photo. It supports Tall/Square/Wide. Only the first
photo's URL is stored on the `generations` row.

## Aspect ratios (vertical video)

- **Generate:** only models with `aspectRatios` in `src/lib/fal/models.ts` take an aspect ratio
  (currently Kling 2.0 text-to-video: 9:16, 16:9, 1:1). Image-to-video models follow the uploaded
  image's shape, so upload a vertical photo for vertical output.
- **Export:** step 2 (Put together) renders to 9:16 (720×1280, default), 16:9 (1280×720) or 1:1
  (720×720). "Crop to fill" crops clips that don't match; "Fit with bars" letterboxes them.

## Adding a Fal.ai model

Add an entry to `FAL_MODELS` in `src/lib/fal/models.ts` — no other code changes needed as long as
the endpoint accepts `{ prompt, image_url?, duration, aspect_ratio? }`-shaped input (list the
ratios it accepts in `aspectRatios`; leave it out if the endpoint has no `aspect_ratio` input) and returns
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
