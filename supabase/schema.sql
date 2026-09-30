-- Keemu schema (video ads for Alpha Origins)
-- Run this in the Supabase SQL editor (or via `supabase db push`) after creating a new project.

create extension if not exists "pgcrypto";

-- One row per authenticated user, created by the handle_new_user trigger below.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  business_name text not null default 'Alpha Origins',
  brand_voice jsonb not null default '{
    "tone": "warm, trustworthy, a little playful",
    "pillars": ["real ingredients", "vet-formulated nutrition", "happy, healthy dogs"],
    "avoid": ["fear-based marketing", "medical claims"],
    "default_hashtags": ["#DogFood", "#HealthyDogs", "#PetNutrition"],
    "default_cta": "Shop the bag your dog deserves."
  }'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  create type generation_status as enum ('queued', 'processing', 'completed', 'failed');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists generations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  owner_id uuid not null references profiles (id) on delete cascade,
  prompt text not null,
  model text not null,
  duration_seconds integer not null,
  reference_image_url text,
  fal_request_id text,
  status generation_status not null default 'queued',
  video_url text,
  thumbnail_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists clips (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  generation_id uuid references generations (id) on delete set null,
  source_url text not null,
  trim_start numeric not null default 0,
  trim_end numeric,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  owner_id uuid not null references profiles (id) on delete cascade,
  video_url text not null,
  thumbnail_url text,
  duration_seconds numeric,
  clip_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists captions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  export_id uuid references exports (id) on delete set null,
  platform text not null check (platform in ('instagram_reels', 'facebook_ads', 'tiktok', 'youtube_shorts')),
  content text not null,
  hashtags text[] not null default '{}',
  brand_voice_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists generations_project_id_idx on generations (project_id);
create index if not exists clips_project_id_idx on clips (project_id, order_index);
create index if not exists exports_project_id_idx on exports (project_id);
create index if not exists captions_project_id_idx on captions (project_id);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- business_name comes from signUp's options.data (see src/app/login/page.tsx).
  insert into public.profiles (id, business_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'business_name', ''), 'Alpha Origins')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Keep updated_at fresh.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_projects_updated_at on projects;
create trigger set_projects_updated_at before update on projects
  for each row execute procedure set_updated_at();

drop trigger if exists set_generations_updated_at on generations;
create trigger set_generations_updated_at before update on generations
  for each row execute procedure set_updated_at();

-- Let the browser receive live generation status updates (src/hooks/useGenerations.ts subscribes
-- via Supabase Realtime). RLS still applies, so users only receive their own rows.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'generations'
  ) then
    alter publication supabase_realtime add table generations;
  end if;
end;
$$;
