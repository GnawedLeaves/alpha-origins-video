-- Row Level Security policies for Alpha Origins
-- Run after schema.sql.

alter table profiles enable row level security;
alter table projects enable row level security;
alter table generations enable row level security;
alter table clips enable row level security;
alter table exports enable row level security;
alter table captions enable row level security;

-- profiles: a user can read/update only their own profile row.
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- projects: full CRUD scoped to owner_id.
create policy "projects_select_own" on projects
  for select using (auth.uid() = owner_id);

create policy "projects_insert_own" on projects
  for insert with check (auth.uid() = owner_id);

create policy "projects_update_own" on projects
  for update using (auth.uid() = owner_id);

create policy "projects_delete_own" on projects
  for delete using (auth.uid() = owner_id);

-- generations: scoped to owner_id directly (denormalized for simple RLS + the webhook route).
create policy "generations_select_own" on generations
  for select using (auth.uid() = owner_id);

create policy "generations_insert_own" on generations
  for insert with check (auth.uid() = owner_id);

create policy "generations_update_own" on generations
  for update using (auth.uid() = owner_id);

create policy "generations_delete_own" on generations
  for delete using (auth.uid() = owner_id);

-- clips: scoped via the parent project's owner_id.
create policy "clips_select_own" on clips
  for select using (
    exists (select 1 from projects p where p.id = clips.project_id and p.owner_id = auth.uid())
  );

create policy "clips_insert_own" on clips
  for insert with check (
    exists (select 1 from projects p where p.id = clips.project_id and p.owner_id = auth.uid())
  );

create policy "clips_update_own" on clips
  for update using (
    exists (select 1 from projects p where p.id = clips.project_id and p.owner_id = auth.uid())
  );

create policy "clips_delete_own" on clips
  for delete using (
    exists (select 1 from projects p where p.id = clips.project_id and p.owner_id = auth.uid())
  );

-- exports: scoped to owner_id directly.
create policy "exports_select_own" on exports
  for select using (auth.uid() = owner_id);

create policy "exports_insert_own" on exports
  for insert with check (auth.uid() = owner_id);

create policy "exports_delete_own" on exports
  for delete using (auth.uid() = owner_id);

-- captions: scoped via the parent project's owner_id.
create policy "captions_select_own" on captions
  for select using (
    exists (select 1 from projects p where p.id = captions.project_id and p.owner_id = auth.uid())
  );

create policy "captions_insert_own" on captions
  for insert with check (
    exists (select 1 from projects p where p.id = captions.project_id and p.owner_id = auth.uid())
  );

create policy "captions_delete_own" on captions
  for delete using (
    exists (select 1 from projects p where p.id = captions.project_id and p.owner_id = auth.uid())
  );

-- Storage: two buckets, each object path-prefixed with the owning user's uid, e.g. `{uid}/{filename}`.
-- Create the buckets first (Supabase dashboard -> Storage -> New bucket): "reference-images", "exports".
insert into storage.buckets (id, name, public)
  values ('reference-images', 'reference-images', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('exports', 'exports', false)
  on conflict (id) do nothing;

create policy "reference_images_owner_all" on storage.objects
  for all using (
    bucket_id = 'reference-images' and auth.uid()::text = (storage.foldername(name))[1]
  ) with check (
    bucket_id = 'reference-images' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "exports_owner_all" on storage.objects
  for all using (
    bucket_id = 'exports' and auth.uid()::text = (storage.foldername(name))[1]
  ) with check (
    bucket_id = 'exports' and auth.uid()::text = (storage.foldername(name))[1]
  );
