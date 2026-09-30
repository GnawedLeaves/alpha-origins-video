import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
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
    <div className="min-h-screen">
      <Navbar email={user.email} />
      <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 pt-10">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Project</p>
          <h1 className="mt-2 font-display text-heading-sm font-extrabold text-primary break-words">
            {project.name}
          </h1>
        </div>
        <LinkButton href={`/projects/${project.id}/usage`} icon={<BarChart3 />} className="h-11 px-4 text-base">
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
    </div>
  );
}
