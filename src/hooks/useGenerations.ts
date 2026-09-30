"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Generation } from "@/lib/types/domain";

// Combines two update paths so generation status updates land whether or not a public webhook
// URL is configured: Supabase Realtime (picks up webhook-driven DB updates instantly) and a
// polling fallback against /api/fal/status/[requestId] for any generation still queued/processing
// after a few seconds (covers local dev with no public webhook URL).
const POLL_MS = 4000;
const MAX_BACKOFF_MS = 30000;
// Consecutive failed checks before the card shows the error and polling pauses.
const MAX_FAILURES = 3;

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

  // Per-generation polling bookkeeping (refs: read inside the timer, no re-render needed).
  const nextCheckAt = useRef(new Map<string, number>());
  const failures = useRef(new Map<string, number>());
  const inFlight = useRef(new Set<string>());
  // Shown on the card when checking keeps failing; polling for that generation stops until
  // the user presses "Try again".
  const [checkErrors, setCheckErrors] = useState<Record<string, string>>({});
  const checkErrorsRef = useRef(checkErrors);
  useEffect(() => {
    checkErrorsRef.current = checkErrors;
  }, [checkErrors]);

  const replace = useCallback((generation: Generation) => {
    setGenerations((prev) => prev.map((g) => (g.id === generation.id ? generation : g)));
  }, []);

  useEffect(() => {
    const pending = generations.filter(
      (g) => (g.status === "queued" || g.status === "processing") && g.fal_request_id
    );
    if (pending.length === 0) return;

    const check = async (gen: Generation) => {
      inFlight.current.add(gen.id);
      try {
        const res = await fetch(`/api/fal/status/${gen.fal_request_id}`);
        const body = (await res.json().catch(() => ({}))) as {
          generation?: Generation;
          error?: string;
        };
        if (!res.ok) throw new Error(body.error ?? `Checking failed (${res.status})`);
        failures.current.delete(gen.id);
        nextCheckAt.current.set(gen.id, Date.now() + POLL_MS);
        if (body.generation) replace(body.generation);
      } catch (err) {
        const count = (failures.current.get(gen.id) ?? 0) + 1;
        failures.current.set(gen.id, count);
        // Back off: 8s, then 16s (capped at 30s), before the error shows after the 3rd failure.
        nextCheckAt.current.set(gen.id, Date.now() + Math.min(POLL_MS * 2 ** count, MAX_BACKOFF_MS));
        if (count >= MAX_FAILURES) {
          setCheckErrors((prev) => ({ ...prev, [gen.id]: (err as Error).message }));
        }
      } finally {
        inFlight.current.delete(gen.id);
      }
    };

    const tick = () => {
      const now = Date.now();
      for (const gen of pending) {
        if (inFlight.current.has(gen.id) || checkErrorsRef.current[gen.id]) continue;
        if ((nextCheckAt.current.get(gen.id) ?? 0) > now) continue;
        check(gen);
      }
    };
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [generations, replace]);

  function addOptimistic(generation: Generation) {
    // First check after a normal interval: the job was only just submitted.
    nextCheckAt.current.set(generation.id, Date.now() + POLL_MS);
    setGenerations((prev) => [generation, ...prev]);
  }

  // After the card showed a checking error: start checking again right away.
  function retryCheck(id: string) {
    failures.current.delete(id);
    nextCheckAt.current.delete(id);
    setCheckErrors((prev) => withoutKey(prev, id));
  }

  async function cancel(id: string) {
    const res = await fetch(`/api/generations/${id}/cancel`, { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as { generation?: Generation; error?: string };
    if (!res.ok) throw new Error(body.error ?? "Couldn't cancel. Please try again.");
    if (body.generation) replace(body.generation);
    setCheckErrors((prev) => withoutKey(prev, id));
  }

  async function remove(id: string) {
    const { error } = await supabase.from("generations").delete().eq("id", id);
    if (error) throw new Error(`Couldn't remove it: ${error.message}`);
    setGenerations((prev) => prev.filter((g) => g.id !== id));
  }

  return { generations, addOptimistic, checkErrors, retryCheck, cancel, remove };
}

function withoutKey<T>(record: Record<string, T>, key: string) {
  const next = { ...record };
  delete next[key];
  return next;
}
