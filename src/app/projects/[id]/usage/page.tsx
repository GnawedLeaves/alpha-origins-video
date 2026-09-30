import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { LinkButton } from "@/components/layout/LinkButton";
import { Badge } from "@/components/ui/badge";
import { ExpandableText } from "@/components/common/ExpandableText";
import { CostChart, type UsagePoint } from "@/components/usage/CostChart";
import { LocalDateTime } from "@/components/usage/LocalDateTime";
import { FAL_MODELS } from "@/lib/fal/models";
import { costOf, getModelPrices, type ModelPrice } from "@/lib/fal/pricing";
import { isCancelled, type Generation } from "@/lib/types/domain";

const money = (v: number) => `$${v.toFixed(2)}`;

function priceLabel(price: ModelPrice | null) {
  if (!price) return "No price set";
  return `${money(price.usd)} per ${price.unit}`;
}

function statusLabel(g: Pick<Generation, "status" | "error">) {
  if (isCancelled(g)) return "Cancelled";
  return { queued: "Waiting", processing: "Being made", completed: "Made", failed: "Didn't work" }[g.status];
}

export default async function UsagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase.from("projects").select("id, name").eq("id", id).single();
  if (!project) notFound();

  const [{ data: generations }, { count: exportCount }, { count: captionCount }, prices] = await Promise.all([
    supabase
      .from("generations")
      .select("id, prompt, model, duration_seconds, status, error, created_at")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("exports").select("id", { count: "exact", head: true }).eq("project_id", id),
    supabase.from("captions").select("id", { count: "exact", head: true }).eq("project_id", id),
    getModelPrices(),
  ]);

  const rows = (generations ?? []).map((g) => {
    const completed = g.status === "completed";
    // Only finished videos are counted as billed: fal.ai doesn't charge for failed requests, and
    // a cancel that reached fal before the job started isn't charged either.
    const cost = completed ? costOf(prices[g.model], g.duration_seconds) : 0;
    return { ...g, completed, cost };
  });

  const made = rows.filter((r) => r.completed);
  const totalCost = made.reduce((sum, r) => sum + (r.cost ?? 0), 0);
  const unpriced = made.filter((r) => r.cost === null).length;
  const seconds = made.reduce((sum, r) => sum + r.duration_seconds, 0);
  const notMade = rows.length - made.length;
  const points: UsagePoint[] = rows.map((r) => ({ createdAt: r.created_at, cost: r.cost, completed: r.completed }));

  const byModel = FAL_MODELS.map((m) => {
    const list = made.filter((r) => r.model === m.id);
    return {
      id: m.id,
      label: m.label,
      price: prices[m.id],
      videos: list.length,
      seconds: list.reduce((s, r) => s + r.duration_seconds, 0),
      cost: list.reduce((s, r) => s + (r.cost ?? 0), 0),
    };
  }).filter((m) => m.videos > 0);
  const anyLivePrice = Object.values(prices).some((p) => p?.source === "fal");

  return (
    <div className="min-h-screen">
      <Navbar email={user.email} />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <LinkButton href={`/projects/${project.id}`} icon={<ArrowLeft />} variant="ghost" className="-ml-2 h-10 px-2 text-base">
          Back to {project.name}
        </LinkButton>
        <h1 className="mt-4 font-display text-heading-sm font-extrabold text-primary">Usage &amp; cost</h1>
        <p className="mt-2 text-muted-foreground">
          Every video made in <span className="font-medium text-foreground">{project.name}</span>, and
          roughly what it cost on fal.ai.
        </p>

        {/* KPI row: the estimated cost leads */}
        <section aria-label="Totals" className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="col-span-2 rounded-xl bg-card p-5 ring-1 ring-foreground/15 lg:col-span-1 lg:row-span-1">
            <p className="text-sm text-muted-foreground">Estimated fal.ai cost</p>
            <p className="mt-1 text-5xl font-semibold tracking-tight">{money(totalCost)}</p>
            {unpriced > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                + {unpriced} video{unpriced === 1 ? "" : "s"} with no price set
              </p>
            )}
          </div>
          <Stat label="Videos made" value={made.length} note={notMade ? `${notMade} didn't finish or were cancelled` : undefined} />
          <Stat label="Seconds of video" value={seconds} />
          <Stat label="Final videos saved" value={exportCount ?? 0} />
          <Stat label="Captions written" value={captionCount ?? 0} note="Free (Gemini)" />
        </section>

        <div className="mt-6">
          <CostChart points={points} />
        </div>

        {byModel.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">By video style</h2>
            <div className="mt-3 overflow-x-auto rounded-xl ring-1 ring-foreground/15">
              <table className="w-full min-w-[36rem] text-left">
                <thead className="bg-muted/60 text-sm text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Style</th>
                    <th className="px-4 py-2 font-medium">Price</th>
                    <th className="px-4 py-2 text-right font-medium">Videos</th>
                    <th className="px-4 py-2 text-right font-medium">Seconds</th>
                    <th className="px-4 py-2 text-right font-medium">Estimated cost</th>
                  </tr>
                </thead>
                <tbody>
                  {byModel.map((m) => (
                    <tr key={m.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{m.label}</td>
                      <td className="px-4 py-3 text-sm">
                        {priceLabel(m.price)}
                        {m.price && (
                          <span className="block text-muted-foreground">
                            {m.price.source === "fal" ? "from fal.ai" : "built-in estimate"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{m.videos}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{m.seconds}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{m.price ? money(m.cost) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-lg font-semibold">History</h2>
          {rows.length === 0 ? (
            <p className="mt-3 rounded-xl bg-muted p-6 text-muted-foreground">
              No videos yet. Make one in step 1 of the project.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl ring-1 ring-foreground/15">
              <table className="w-full min-w-[48rem] text-left">
                <thead className="bg-muted/60 text-sm text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">When</th>
                    <th className="px-4 py-2 font-medium">Description</th>
                    <th className="px-4 py-2 font-medium">Style</th>
                    <th className="px-4 py-2 text-right font-medium">Length</th>
                    <th className="px-4 py-2 font-medium">Result</th>
                    <th className="px-4 py-2 text-right font-medium">Est. cost</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border align-top">
                      <td className="px-4 py-3 text-sm">
                        <LocalDateTime iso={r.created_at} />
                      </td>
                      <td className="max-w-md px-4 py-3">
                        <ExpandableText text={r.prompt} />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {FAL_MODELS.find((m) => m.id === r.model)?.label ?? r.model}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.duration_seconds}s</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={r.status === "failed" && !isCancelled(r) ? "destructive" : "secondary"}
                          className="h-auto py-1 text-sm"
                        >
                          {statusLabel(r)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {!r.completed ? "$0.00" : r.cost === null ? "—" : money(r.cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="mt-8 flex gap-3 rounded-xl bg-secondary p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            These are estimates: finished videos × each style&apos;s price
            {anyLivePrice ? " (live from fal.ai where available, otherwise a built-in estimate)" : " (built-in estimates)"}
            . Videos that didn&apos;t finish are counted as $0; a video cancelled after it had
            already started may still be charged by fal.ai. Your exact bill is at fal.ai →
            Dashboard → Billing.
          </p>
        </aside>
      </main>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/15">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value.toLocaleString()}</p>
      {note && <p className="mt-1 text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}
