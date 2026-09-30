import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";

// Shell for every signed-in page: the sidebar stays put while pages change (their loading
// skeletons render inside the main column), and content sits in one centred 900px column.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .order("updated_at", { ascending: false })
    .limit(8);

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email} projects={projects ?? []} />
      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-[900px] px-4 py-8 sm:px-6 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
