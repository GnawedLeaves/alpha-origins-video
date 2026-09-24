"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Generation } from "@/lib/types/domain";

// Combines two update paths so generation status updates land whether or not a public webhook
// URL is configured: Supabase Realtime (picks up webhook-driven DB updates instantly) and a
// polling fallback against /api/fal/status/[requestId] for any generation still queued/processing
// after a few seconds (covers local dev with no public webhook URL).
export function useGenerations(projectId: string, initial: Generation[]) {
  const [generations, setGenerations] = useState<Generation[]>(initial);
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    const channel = supabase
      .channel(`generations-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "generations", filter: `project_id=eq.${projectId}` },
        (payload) => {
          setGenerations((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((g) => g.id !== (payload.old as Generation).id);
            }
            const next = payload.new as Generation;
            const exists = prev.some((g) => g.id === next.id);
            return exists
              ? prev.map((g) => (g.id === next.id ? next : g))
              : [next, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, supabase]);

  useEffect(() => {
    const pending = generations.filter(
      (g) => (g.status === "queued" || g.status === "processing") && g.fal_request_id
    );
    if (pending.length === 0) return;

    const interval = setInterval(async () => {
      for (const gen of pending) {
        try {
          const res = await fetch(`/api/fal/status/${gen.fal_request_id}`);
          if (!res.ok) continue;
          const { generation } = (await res.json()) as { generation?: Generation };
          if (generation) {
            setGenerations((prev) => prev.map((g) => (g.id === generation.id ? generation : g)));
          }
        } catch {
          // network hiccup — try again next tick
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [generations]);

  function addOptimistic(generation: Generation) {
    setGenerations((prev) => [generation, ...prev]);
  }

  return { generations, addOptimistic };
}
