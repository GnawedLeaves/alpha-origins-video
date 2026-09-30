import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectWorkspace } from "@/components/workspace/ProjectWorkspace";
import { LinkButton } from "@/components/layout/LinkButton";
import { BarChart3 } from "lucide-react";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase.from("projects").select("*").eq("id", id).single();
  if (!project) notFound();

  const { data: generations } = await supabase
    .from("generations")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  const { data: captions } = await supabase
    .from("captions")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  const { data: profile } = await supabase
    .from("profiles")
    .select("brand_voice")
    .eq("id", user.id)
    .single();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 text-3xl font-medium tracking-tight break-words">{project.name}</h1>
        <LinkButton href={`/projects/${project.id}/usage`} icon={<BarChart3 />} className="h-10 px-3 text-base">
          Usage &amp; cost
        </LinkButton>
      </div>
      <ProjectWorkspace
        project={project}
        userId={user.id}
        initialGenerations={generations ?? []}
        initialCaptions={captions ?? []}
        brandVoice={
          profile?.brand_voice ?? {
            tone: "warm, trustworthy, a little playful",
            pillars: ["real ingredients", "vet-formulated nutrition", "happy, healthy dogs"],
            avoid: ["fear-based marketing", "medical claims"],
            default_hashtags: ["#DogFood", "#HealthyDogs", "#PetNutrition"],
            default_cta: "Shop the bag your dog deserves.",
          }
        }
      />
    </>
  );
}
