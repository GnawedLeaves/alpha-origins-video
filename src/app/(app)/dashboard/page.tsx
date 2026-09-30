import { FolderOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProjectCardLink } from "@/components/dashboard/ProjectCardLink";
import { NewProjectForm } from "@/components/dashboard/NewProjectForm";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Projects</h1>
          <p className="mt-1 text-muted-foreground">One project per campaign, e.g. a new recipe launch.</p>
        </div>
        <NewProjectForm />
      </div>

      {!projects?.length ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center">
          <FolderOpen className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-medium">No projects yet</h2>
          <p className="mx-auto mt-1 max-w-md text-muted-foreground">
            Create one for each campaign — a product launch, a seasonal promo — then make clips, put
            them together and write the captions inside it.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectCardLink href={`/projects/${project.id}`}>
                <div className="h-full rounded-2xl border border-border bg-card p-4 shadow-subtle transition-colors hover:border-input hover:bg-accent">
                  <p className="truncate text-lg font-medium">{project.name}</p>
                  {project.description && (
                    <p className="mt-1 line-clamp-2 text-muted-foreground">{project.description}</p>
                  )}
                  <p className="mt-3 text-sm text-muted-foreground">
                    Updated {new Date(project.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </ProjectCardLink>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
