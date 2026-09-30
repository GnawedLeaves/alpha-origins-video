"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewProjectForm() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // Keeps "Create" spinning until the new project's page has loaded.
  const [navigating, startNavigation] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not signed in");
      setLoading(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("projects")
      .insert({ owner_id: user.id, name })
      .select()
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? "Failed to create project");
      setLoading(false);
      return;
    }

    startNavigation(() => router.push(`/projects/${data.id}`));
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>+ New project</Button>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        autoFocus
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Fall Launch Campaign"
        className="w-56"
      />
      <Button type="submit" loading={loading || navigating}>
        {navigating ? "Opening…" : "Create"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </form>
  );
}
