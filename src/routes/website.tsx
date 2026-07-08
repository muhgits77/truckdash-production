import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getPublishedData,
  getLatestPublished,
  getConfiguredTruckId,
  DEFAULT_TRUCK_ID,
  type PublishedPayload,
} from "@/lib/publishService";
import { isSupabaseConfigured } from "@/lib/supabase";
import { formatPublishedDay, getTodayWeekdayAbbr } from "@/lib/format-local";
import { useHydrated } from "@/hooks/use-hydrated";
import type { ScheduleDay, MenuItem } from "@/lib/truck-state";

export const Route = createFileRoute("/website")({
  validateSearch: (search: Record<string, unknown>): { truck?: string } => ({
    truck: typeof search.truck === "string" ? search.truck : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Menu & Schedule — Live from TruckDash" },
      {
        name: "description",
        content:
          "Live menu, daily specials, and weekly schedule pulled from TruckDash. Authentic Kentucky flavors in the Lake Cumberland area.",
      },
    ],
  }),
  component: PublicWebsitePreview,
});

/**
 * PUBLIC WEBSITE PREVIEW — "Cluckin Chaos" style / any public site
 *
 * Loads latest publish from Supabase when configured, then falls back to localStorage.
 * Supports ?truck=bluegrass-kitchen for multi-truck projects.
 *
 * Mobile-first. Fast. Warm Kentucky aesthetic matching the TruckDash brand.
 *
 * Hydration: truck id, "today", and locale dates are resolved only after mount
 * so SSR HTML matches the first client paint.
 */
function PublicWebsitePreview() {
  const { truck: truckFromSearch } = Route.useSearch();
  const hydrated = useHydrated();

  // Stable SSR + first paint: query param or default only (no localStorage)
  const searchTruck = truckFromSearch?.trim() || "";
  const [truckId, setTruckId] = useState(() => searchTruck || DEFAULT_TRUCK_ID);
  const [today, setToday] = useState("");
  const [publishedDayLabel, setPublishedDayLabel] = useState("");

  const [data, setData] = useState<PublishedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"supabase" | "local" | null>(null);

  // Client-only: localStorage truck id + local weekday (timezone-safe after hydrate)
  useEffect(() => {
    if (!hydrated) return;
    if (!searchTruck) {
      setTruckId(getConfiguredTruckId() || DEFAULT_TRUCK_ID);
    } else {
      setTruckId(searchTruck);
    }
    setToday(getTodayWeekdayAbbr());
  }, [hydrated, searchTruck]);

  useEffect(() => {
    if (!hydrated) return;

    let mounted = true;
    const id = truckId;

    async function load() {
      setLoading(true);
      setError(null);

      // Prefer Supabase when env is configured (public RLS SELECT)
      if (isSupabaseConfigured()) {
        try {
          const remote = await getLatestPublished(id);
          if (!mounted) return;
          if (remote?.lastPublished) {
            setData(remote);
            setSource("supabase");
            setPublishedDayLabel(formatPublishedDay(remote.lastPublished));
            setLoading(false);
            return;
          }
        } catch {
          /* fall through to local */
        }
      }

      try {
        const published = await getPublishedData(id);
        if (!mounted) return;
        if (!published.lastPublished) {
          setError(
            "No published menu yet. The truck owner needs to tap “Publish Updates to My Website” in TruckDash.",
          );
        }
        setData(published);
        setSource("local");
        if (published.lastPublished) {
          setPublishedDayLabel(formatPublishedDay(published.lastPublished));
        }
        setLoading(false);
      } catch {
        if (mounted) {
          setError("Couldn't load published data.");
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [hydrated, truckId]);

  const todaysSchedule = today ? data?.schedule.find((d) => d.day === today) : undefined;
  const openToday = todaysSchedule && !todaysSchedule.closed;

  return (
    <div className="min-h-screen bg-brand-sand text-brand-green">
      {/* Warm public header — premium but approachable */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-brand-green/10">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <div>
            <Link
              to="/"
              className="text-[10px] uppercase tracking-[0.25em] text-brand-orange font-bold"
            >
              ← Powered by TruckDash
            </Link>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="size-1.5 rounded-full bg-brand-orange" />
              <span className="font-display text-2xl font-bold tracking-tight">
                {data?.truckName || "Our Truck"}
              </span>
            </div>
            <p className="text-[10px] text-brand-green/60 tracking-[0.15em] -mt-0.5">
              LAKE CUMBERLAND • KENTUCKY
            </p>
          </div>

          <a
            href={data?.orderUrl || "#"}
            target="_blank"
            rel="noopener"
            className="text-sm font-bold px-5 py-2 rounded-2xl bg-brand-orange text-white active:scale-[0.985] transition"
          >
            Order Ahead
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-6 pb-20 space-y-8">
        {loading ? (
          <div className="py-12 text-center text-brand-green/60">Loading today's menu…</div>
        ) : error || !data?.lastPublished ? (
          <EmptyState message={error || "No menu published yet."} />
        ) : (
          <>
            {/* Today's highlight — matches the brand's "honest local" warmth */}
            <section>
              <div className="inline-flex flex-wrap items-center gap-2 mb-3">
                <div className="inline-block px-3 py-1 rounded-full bg-brand-orange/10 text-brand-orange text-xs font-bold tracking-[0.2em]">
                  {openToday ? "OPEN TODAY" : "CLOSED TODAY"}
                  {publishedDayLabel ? ` · ${publishedDayLabel}` : ""}
                </div>
                {source && (
                  <span className="text-[10px] uppercase tracking-wider text-brand-green/45 font-semibold">
                    via {source === "supabase" ? "Supabase" : "this device"}
                  </span>
                )}
              </div>

              <h1 className="font-display text-4xl leading-none tracking-[-1.2px] mb-2">
                {data.special || "Today's Special"}
              </h1>

              <div className="flex items-center gap-2 text-lg">
                <span className="text-brand-green/70">📍</span>
                <span className="font-medium">{data.location}</span>
              </div>
              <div className="text-brand-green/70 mt-0.5">
                {data.hoursStart} — {data.hoursEnd}
                {data.phone && (
                  <>
                    {" "}
                    ·{" "}
                    <a href={`tel:${data.phone.replace(/[^\d]/g, "")}`} className="underline">
                      {data.phone}
                    </a>
                  </>
                )}
              </div>
            </section>

            {/* Menu — clean, readable, conversion friendly */}
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-display text-2xl">Menu</h2>
                <span className="text-xs uppercase tracking-widest text-brand-green/50">
                  Updated live from TruckDash
                </span>
              </div>

              <div className="bg-white rounded-3xl border border-brand-green/10 divide-y divide-brand-green/5 overflow-hidden">
                {data.menu.length > 0 ? (
                  data.menu.map((item: MenuItem) => (
                    <div key={item.id} className="flex items-center justify-between px-5 py-3.5">
                      <span className="text-base font-medium pr-4">{item.name}</span>
                      <span className="font-semibold tabular-nums text-brand-orange shrink-0">
                        ${item.price}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-5 py-8 text-brand-green/60 text-sm">Menu coming soon.</div>
                )}
              </div>
            </section>

            {/* This Week schedule — pulled from the same published payload */}
            <section>
              <h2 className="font-display text-2xl mb-3">This Week</h2>

              <div className="space-y-2">
                {data.schedule.map((day: ScheduleDay) => {
                  const isToday = day.day === today;
                  const closed = !!day.closed;
                  return (
                    <div
                      key={day.id}
                      className={`bg-white rounded-2xl border px-4 py-3 flex gap-3 ${
                        isToday
                          ? "border-brand-orange ring-1 ring-brand-orange/20"
                          : "border-brand-green/10"
                      }`}
                    >
                      <div
                        className={`w-12 shrink-0 font-bold text-sm pt-0.5 ${
                          isToday ? "text-brand-orange" : "text-brand-green/80"
                        }`}
                      >
                        {day.day}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold ${closed ? "line-through opacity-60" : ""}`}>
                          {closed ? day.note || "Closed" : day.neighborhood}
                        </div>
                        {!closed && (
                          <div className="text-sm text-brand-green/70 truncate">{day.spot}</div>
                        )}
                        {day.note && !closed && (
                          <div className="text-xs text-brand-green/60 mt-0.5">{day.note}</div>
                        )}
                      </div>
                      <div className="text-right text-sm font-medium whitespace-nowrap text-brand-green/80">
                        {closed ? "—" : `${day.hoursStart}–${day.hoursEnd}`}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-center text-xs text-brand-green/50 mt-3">
                Schedule pulled from TruckDash publish. Hours can change — call ahead.
              </p>
            </section>

            {/* CTA bar */}
            <div className="pt-2">
              <a
                href={data.orderUrl || "#"}
                target="_blank"
                rel="noopener"
                className="block w-full text-center py-4 rounded-3xl bg-brand-green text-white font-bold text-base shadow active:scale-[0.985]"
              >
                Order Ahead or Call {data.phone || "Us"}
              </a>
              <div className="text-center text-[10px] text-brand-green/50 mt-3">
                Changes made in TruckDash appear here after the owner hits “Publish”.
                {truckId ? (
                  <>
                    {" "}
                    Truck: <span className="font-mono">{truckId}</span>
                  </>
                ) : null}
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="text-center text-[10px] py-8 border-t border-brand-green/10 text-brand-green/40">
        Authentic Kentucky cooking • Lake Cumberland &amp; Central Kentucky
        <br />
        <Link to="/menu" className="underline">
          Clean Menu
        </Link>{" "}
        ·{" "}
        <Link to="/schedule" className="underline">
          Schedule
        </Link>{" "}
        ·{" "}
        <Link to="/" className="underline">
          TruckDash
        </Link>
      </footer>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="max-w-md mx-auto pt-12 text-center">
      <div className="mx-auto size-16 rounded-full bg-brand-orange/10 flex items-center justify-center text-4xl mb-6">
        🍂
      </div>
      <h2 className="font-display text-3xl tracking-tight">Menu not live yet</h2>
      <p className="mt-3 text-brand-green/70">{message}</p>

      <div className="mt-8 bg-white border border-brand-green/10 rounded-3xl p-5 text-left text-sm">
        <div className="font-semibold mb-2 text-brand-green">Truck owner?</div>
        <ol className="list-decimal list-inside space-y-1 text-brand-green/70">
          <li>Open TruckDash</li>
          <li>Update your Menu or This Week schedule</li>
          <li>Enable Supabase Sync in Settings (optional, for any device)</li>
          <li>Tap “Publish Updates to My Website”</li>
          <li>Refresh this page — it’s live!</li>
        </ol>
      </div>

      <Link to="/" className="mt-6 inline-block text-sm font-bold text-brand-orange">
        Open TruckDash →
      </Link>
    </div>
  );
}
