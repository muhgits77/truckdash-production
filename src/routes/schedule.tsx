import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getPublishedData, type PublishedPayload } from "@/lib/publishService";
import { formatPublishedShort, getTodayWeekdayAbbr } from "@/lib/format-local";
import { useHydrated } from "@/hooks/use-hydrated";
import type { ScheduleDay } from "@/lib/truck-state";

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: [
      { title: "This Week — Cluckin Chaos | Lake Cumberland" },
      {
        name: "description",
        content:
          "Weekly schedule and locations for Cluckin Chaos food truck. Pulled live from TruckDash. Lake Cumberland, Monticello, Central Kentucky.",
      },
    ],
  }),
  component: PublicSchedulePage,
});

/**
 * PUBLIC SCHEDULE PAGE — Cluckin Chaos style
 * Reads exclusively from the published snapshot (getPublishedData).
 * Clean, mobile-first, warm Kentucky aesthetic.
 * Highlights today. Graceful fallback when nothing published.
 */
function PublicSchedulePage() {
  const hydrated = useHydrated();
  const [data, setData] = useState<PublishedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayAbbr, setTodayAbbr] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    setTodayAbbr(getTodayWeekdayAbbr());

    let mounted = true;
    getPublishedData()
      .then((published) => {
        if (!mounted) return;
        setData(published);
        setLastUpdated(
          published.lastPublished ? formatPublishedShort(published.lastPublished) : null,
        );
        setLoading(false);
      })
      .catch(() => {
        if (mounted) {
          setData(null);
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [hydrated]);

  const hasData = !!data?.lastPublished && (data.schedule?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-brand-sand text-brand-green">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-brand-green/10">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <div>
            <Link
              to="/menu"
              className="text-[10px] uppercase tracking-[0.25em] text-brand-orange font-bold"
            >
              ← Menu
            </Link>
            <div className="flex items-center gap-2 mt-1">
              <span className="size-1.5 rounded-full bg-brand-orange" />
              <span className="font-display text-2xl font-bold tracking-tight">
                {hasData ? data!.truckName : "Cluckin Chaos"}
              </span>
            </div>
            <p className="text-[10px] text-brand-green/60 tracking-[0.2em] -mt-0.5">
              THIS WEEK • LAKE CUMBERLAND
            </p>
          </div>

          <a
            href={hasData && data!.orderUrl ? data!.orderUrl : "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-bold px-4 py-2 rounded-2xl bg-brand-orange text-white active:scale-[0.985] transition"
          >
            Order Ahead
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-6 pb-16">
        {loading ? (
          <div className="py-10 text-center text-brand-green/60">Loading schedule…</div>
        ) : !hasData ? (
          <NoScheduleState />
        ) : (
          <>
            <div className="mb-5">
              <h1 className="font-display text-3xl tracking-tight">This Week</h1>
              <p className="text-brand-green/70 mt-1 text-sm">
                Locations, hours &amp; notes. All pulled from TruckDash publish.
              </p>
            </div>

            <div className="space-y-2.5">
              {data!.schedule.map((day: ScheduleDay) => {
                const isToday = day.day === todayAbbr;
                const isClosed = !!day.closed;

                return (
                  <div
                    key={day.id}
                    className={`bg-white rounded-3xl border px-4 py-4 flex gap-4 transition ${isToday ? "border-brand-orange ring-1 ring-brand-orange/25" : "border-brand-green/10"}`}
                  >
                    <div
                      className={`w-12 shrink-0 font-bold text-sm tracking-wider pt-0.5 ${isToday ? "text-brand-orange" : "text-brand-green/70"}`}
                    >
                      {day.day}
                      {isToday && (
                        <div className="text-[9px] text-brand-orange/70 font-normal tracking-normal">
                          TODAY
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div
                        className={`font-semibold text-[15px] ${isClosed ? "opacity-60 line-through" : ""}`}
                      >
                        {isClosed ? day.note || "Closed" : day.neighborhood}
                      </div>

                      {!isClosed && (
                        <div className="text-sm text-brand-green/70 truncate mt-px">{day.spot}</div>
                      )}

                      {day.note && !isClosed && (
                        <div className="inline-block mt-1 text-xs bg-brand-orange/10 text-brand-orange px-2 py-px rounded font-medium">
                          {day.note}
                        </div>
                      )}
                    </div>

                    <div className="text-right text-sm font-medium whitespace-nowrap text-brand-green/80 pt-0.5">
                      {isClosed ? "—" : `${day.hoursStart}–${day.hoursEnd}`}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Subtle last updated */}
            {lastUpdated && (
              <div className="mt-6 text-center text-[10px] text-brand-green/40">
                Last updated from TruckDash:{" "}
                <span className="font-medium text-brand-green/60">{lastUpdated}</span>
              </div>
            )}

            {/* Contact / CTA */}
            <div className="mt-8 bg-white border border-brand-green/10 rounded-3xl p-5 text-sm">
              <div className="font-semibold mb-1">Questions or want to book us?</div>
              <div className="text-brand-green/70">
                {data!.phone && <>Call {data!.phone} · </>}
                {data!.orderUrl && (
                  <a
                    href={data!.orderUrl}
                    target="_blank"
                    rel="noopener"
                    className="text-brand-orange underline"
                  >
                    Order ahead online
                  </a>
                )}
              </div>
              <div className="mt-3 text-xs text-brand-green/50">
                Schedule subject to weather and events. Always best to confirm.
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="text-center text-[10px] text-brand-green/40 border-t border-brand-green/10 py-6">
        Cluckin Chaos • Honest food from the Bluegrass
        <br />
        <Link to="/menu" className="underline hover:text-brand-green">
          Back to today’s menu
        </Link>
      </footer>
    </div>
  );
}

function NoScheduleState() {
  return (
    <div className="max-w-md mx-auto pt-8 text-center">
      <div className="mx-auto size-14 rounded-full bg-brand-orange/10 flex items-center justify-center mb-5 text-3xl">
        🗓️
      </div>
      <h2 className="font-display text-2xl tracking-tight">Schedule not published yet</h2>
      <p className="mt-2 text-brand-green/70">
        The owner will publish their weekly locations from TruckDash.
      </p>

      <Link
        to="/menu"
        className="mt-8 inline-block rounded-2xl border border-brand-green/15 bg-white px-5 py-2 text-sm font-semibold"
      >
        View Menu
      </Link>

      <div className="mt-10 text-xs text-brand-green/50">
        Truck owners: publish from the dashboard to make this live.
      </div>
    </div>
  );
}
