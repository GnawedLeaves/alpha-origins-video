"use client";

import { useMemo, useState } from "react";
import { useIsClient } from "./useIsClient";

export interface UsagePoint {
  createdAt: string;
  // null = this video's model has no price set.
  cost: number | null;
  completed: boolean;
}

const DAYS = 30;
const PLOT_HEIGHT = 200;

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Round a max up to a clean axis top with 4 steps: 0.4 -> 0.4, 2.3 -> 3, 7 -> 8, 13 -> 20…
function niceScale(max: number) {
  if (max <= 0) return { top: 1, step: 0.25 };
  const rough = max / 4;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? 10 * mag;
  return { top: step * 4, step };
}

const money = (v: number) => (v >= 100 ? `$${v.toFixed(0)}` : `$${v.toFixed(2)}`);

// Single-series column chart: estimated fal.ai cost per day over the last 30 days (local time).
// Every value is also in the history table below it, so the tooltip never gates information.
export function CostChart({ points }: { points: UsagePoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  // Days are the viewer's local days, so only bucket once running in the browser.
  const isClient = useIsClient();

  const days = useMemo(() => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const list = Array.from({ length: DAYS }, (_, i) => {
      const d = new Date(end);
      d.setDate(end.getDate() - (DAYS - 1 - i));
      return { date: d, cost: 0, videos: 0, unpriced: 0 };
    });
    const index = new Map(list.map((d, i) => [dayKey(d.date), i]));
    for (const p of points) {
      if (!p.completed) continue;
      const i = index.get(dayKey(new Date(p.createdAt)));
      if (i === undefined) continue;
      list[i].videos++;
      if (p.cost === null) list[i].unpriced++;
      else list[i].cost += p.cost;
    }
    return list;
    // isClient: recompute with the browser's clock and time zone after hydration.
  }, [points, isClient]); // eslint-disable-line react-hooks/exhaustive-deps

  const max = Math.max(...days.map((d) => d.cost));
  const { top, step } = niceScale(max);
  const ticks = Array.from({ length: 5 }, (_, i) => i * step);
  const anyVideos = days.some((d) => d.videos > 0);
  const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

  return (
    <figure className="rounded-xl bg-card p-4 ring-1 ring-foreground/15 sm:p-5">
      <figcaption>
        <p className="font-semibold">Estimated fal.ai cost per day</p>
        <p className="text-sm text-muted-foreground">Last 30 days · finished videos only</p>
      </figcaption>

      {!isClient ? (
        <div className="mt-5 animate-pulse rounded-lg bg-muted" style={{ height: PLOT_HEIGHT + 28 }} />
      ) : !anyVideos ? (
        <p className="mt-6 rounded-lg bg-muted p-6 text-center text-muted-foreground">
          No finished videos in the last 30 days.
        </p>
      ) : (
        <div className="mt-6 flex gap-2">
          {/* Y axis: clean ticks, text in muted ink */}
          <div className="relative w-12 shrink-0" style={{ height: PLOT_HEIGHT }} aria-hidden="true">
            {ticks.map((t) => (
              <span
                key={t}
                // `bottom` places the label's bottom edge on the gridline; shift down half its height
                // to centre it there.
                className="absolute right-0 translate-y-1/2 text-xs text-muted-foreground tabular-nums"
                style={{ bottom: `${(t / top) * 100}%` }}
              >
                {money(t)}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div className="relative" style={{ height: PLOT_HEIGHT }}>
              {/* Hairline, solid, recessive gridlines */}
              {ticks.map((t) => (
                <div
                  key={t}
                  className="absolute inset-x-0 border-t border-border"
                  style={{ bottom: `${(t / top) * 100}%` }}
                  aria-hidden="true"
                />
              ))}
              <div className="absolute inset-0 flex items-end gap-[2px]" role="list" aria-label="Cost per day">
                {days.map((d, i) => {
                  const label = `${fmtDay(d.date)}: ${money(d.cost)}, ${d.videos} video${d.videos === 1 ? "" : "s"}${d.unpriced ? `, ${d.unpriced} without a price` : ""}`;
                  return (
                    <div
                      key={i}
                      role="listitem"
                      tabIndex={d.videos ? 0 : -1}
                      aria-label={label}
                      onPointerEnter={() => setActive(i)}
                      onPointerLeave={() => setActive((a) => (a === i ? null : a))}
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive((a) => (a === i ? null : a))}
                      className="relative flex h-full flex-1 items-end justify-center outline-none"
                    >
                      {d.cost > 0 && (
                        <div
                          className={`w-full max-w-6 rounded-t-[4px] bg-primary transition-opacity ${active === i ? "opacity-75" : ""}`}
                          style={{ height: `${Math.max(2, (d.cost / top) * 100)}%` }}
                        />
                      )}
                      {d.cost === 0 && d.unpriced > 0 && (
                        // Videos made that day but nothing to price: a small marker so the day isn't blank.
                        <div className="h-1 w-full max-w-6 rounded-t-[4px] bg-muted-foreground/40" />
                      )}
                      {active === i && d.videos > 0 && (
                        <div
                          role="tooltip"
                          className={`pointer-events-none absolute bottom-full z-10 mb-2 w-max max-w-48 rounded-lg bg-popover px-3 py-2 text-sm text-popover-foreground shadow-subtle-2 ring-1 ring-border ${i > DAYS - 6 ? "right-0" : i < 5 ? "left-0" : "left-1/2 -translate-x-1/2"}`}
                        >
                          <p className="font-medium">{fmtDay(d.date)}</p>
                          <p className="tabular-nums">{money(d.cost)}</p>
                          <p className="text-muted-foreground">
                            {d.videos} video{d.videos === 1 ? "" : "s"}
                            {d.unpriced ? ` (${d.unpriced} without a price)` : ""}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* X axis: a date every 5 days plus today */}
            <div className="relative mt-2 h-5" aria-hidden="true">
              {days.map((d, i) =>
                i % 5 === 4 || i === 0 ? (
                  <span
                    key={i}
                    className="absolute -translate-x-1/2 text-xs whitespace-nowrap text-muted-foreground"
                    style={{ left: `${((i + 0.5) / DAYS) * 100}%` }}
                  >
                    {i === DAYS - 1 ? "Today" : d.date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                  </span>
                ) : null
              )}
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}
