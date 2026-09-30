import { createClient } from "@/lib/supabase/server";
import { ProjectCardLink } from "@/components/dashboard/ProjectCardLink";
import { Navbar } from "@/components/layout/Navbar";
import { NewProjectForm } from "@/components/dashboard/NewProjectForm";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SketchDoodle } from "@/components/brand/SketchDoodle";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  return (
    <div className="min-h-screen">
      <Navbar email={user?.email} />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Dashboard
            </p>
            <h1 className="mt-2 font-display text-heading-sm font-extrabold text-primary">
              Your <span className="highlight-marker">projects</span>
            </h1>
          </div>
          <NewProjectForm />
        </div>

        {!projects?.length ? (
          <div className="relative mt-16 flex justify-center">
            <SketchDoodle className="absolute -top-10 left-0 hidden w-72 md:block" />
            {/* Sticky-note empty state. */}
            <div className="relative max-w-md rounded-2xl bg-sticky-note-blush p-7 text-forest-ink">
              <h2 className="text-xl font-semibold">No projects yet</h2>
              <p className="mt-2 text-body-sm">
                Create one for each campaign — a product launch, a seasonal promo — then generate
                clips, cut them together and write the captions inside it.
              </p>
            </div>
          </div>
        ) : (
          <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <li key={project.id}>
                <ProjectCardLink href={`/projects/${project.id}`}>
                  <Card className="h-full transition-colors hover:bg-accent hover:ring-foreground/30">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold">{project.name}</CardTitle>
                      {project.description && (
                        <CardDescription className="line-clamp-2">
                          {project.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <p className="px-4 font-mono text-micro text-muted-foreground">
                      Updated {new Date(project.updated_at).toLocaleDateString()}
                    </p>
                  </Card>
                </ProjectCardLink>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
