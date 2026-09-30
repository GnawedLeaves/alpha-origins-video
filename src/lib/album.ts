// The photo album is simply the user's folder in the public `reference-images` bucket
// (`{userId}/...`, see supabase/policies.sql). No table needed: listing the folder is the album.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { shrinkImage } from "@/lib/utils/image";

const BUCKET = "reference-images";

export interface AlbumPhoto {
  path: string;
  url: string;
  createdAt: string | null;
}

type AnySupabase = SupabaseClient<Database>;

function toPhoto(supabase: AnySupabase, path: string, createdAt: string | null): AlbumPhoto {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl, createdAt };
}

export async function listAlbum(supabase: AnySupabase, userId: string): Promise<AlbumPhoto[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list(userId, {
    limit: 200,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) throw new Error(`Couldn't load your photos: ${error.message}`);
  return (data ?? [])
    .filter((f) => f.id && !f.name.startsWith(".")) // skip folders and placeholder files
    .map((f) => toPhoto(supabase, `${userId}/${f.name}`, f.created_at ?? null));
}

export async function uploadToAlbum(
  supabase: AnySupabase,
  userId: string,
  file: File
): Promise<AlbumPhoto> {
  const blob = await shrinkImage(file);
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
  if (error) throw new Error(`Couldn't save the photo: ${error.message}`);
  return toPhoto(supabase, path, new Date().toISOString());
}

export async function deleteFromAlbum(supabase: AnySupabase, path: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Couldn't remove the photo: ${error.message}`);
}
