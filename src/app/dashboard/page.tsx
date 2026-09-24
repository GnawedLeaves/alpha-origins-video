import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { NewProjectForm } from "@/components/dashboard/NewProjectForm";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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
    <div className="min-h-screen bg-muted/30">
      <Navbar email={user?.email} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Your projects</h1>
          <NewProjectForm />
        </div>

        {!projects?.length ? (
          <div className="mt-16 text-center text-muted-foreground">
            <p>No projects yet. Create one to start generating ads.</p>
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <li key={project.id}>
                <Link href={`/projects/${project.id}`}>
                  <Card className="transition hover:border-primary/40 hover:shadow-md">
                    <CardHeader>
                      <CardTitle>{project.name}</CardTitle>
                      {project.description && (
                        <CardDescription className="line-clamp-2">
                          {project.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <p className="px-6 pb-4 text-xs text-muted-foreground">
                      Updated {new Date(project.updated_at).toLocaleDateString()}
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
