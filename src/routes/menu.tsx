import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getPublishedData,
  getConfiguredTruckId,
  DEFAULT_TRUCK_ID,
  type PublishedPayload,
} from "@/lib/publishService";
import { menuJsonPublicUrl } from "@/lib/menuStorage";
import { formatPublishedShort } from "@/lib/format-local";
import { useHydrated } from "@/hooks/use-hydrated";
import type { MenuItem } from "@/lib/truck-state";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu — Cluckin Chaos | Lake Cumberland" },
      {
        name: "description",
        content:
          "Fresh menu, daily specials, and honest Kentucky flavors. Pulled live from TruckDash. Lake Cumberland food truck.",
      },
    ],
  }),
  component: PublicMenuPage,
});

/**
 * PUBLIC MENU PAGE — Cluckin Chaos style
 * Consumes ONLY published data from TruckDash via publishService.
 *
 * - Today's special, hours, location from snapshot
 * - Full menu list
 * - Subtle "Last updated"
 * - Warm Kentucky aesthetic, mobile-first, fast
 * - Graceful offline / no-data fallback
 */
function PublicMenuPage() {
  const hydrated = useHydrated();
  const [data, setData] = useState<PublishedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    let mounted = true;

    const truckId = getConfiguredTruckId() || DEFAULT_TRUCK_ID;
    console.info("[CluckinChaos/menu] fetch", {
      truckId,
      publicUrl: menuJsonPublicUrl(truckId),
    });

    getPublishedData(truckId)
      .then((published) => {
        if (!mounted) return;
        console.info("[CluckinChaos/menu] loaded", {
          menuItems: published.menu?.length ?? 0,
          lastPublished: published.lastPublished,
        });
        setData(published);
        setLastUpdated(
          published.lastPublished ? formatPublishedShort(published.lastPublished) : null,
        );
        setLoading(false);
      })
      .catch((err) => {
        console.error("[CluckinChaos/menu] load failed", err);
        if (mounted) {
          setData(null);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [hydrated]);

  const hasData = !!data?.lastPublished && data.menu.length > 0;

  return (
    <div className="min-h-screen bg-brand-sand text-[color:var(--td-ink)] transition-colors duration-200">
      {/* Public header — warm, local, premium */}
      <header className="sticky top-0 z-40 bg-[color:var(--surface)]/92 backdrop-blur-md border-b border-[color:var(--border)]">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link
                to="/"
                className="text-[10px] uppercase tracking-[0.25em] text-brand-orange font-bold hover:underline"
              >
                ← TruckDash
              </Link>
              <div className="flex items-center gap-2 mt-1">
                <span className="size-1.5 rounded-full bg-brand-orange" />
                <span className="font-display text-2xl font-bold tracking-tight">
                  {hasData ? data!.truckName : "Cluckin Chaos"}
                </span>
              </div>
              <p className="text-[10px] text-[color:var(--td-ink-muted)] tracking-[0.2em] -mt-0.5">
                LAKE CUMBERLAND • MONTICELLO • KENTUCKY
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/schedule"
                className="text-xs font-bold px-3 py-1.5 rounded-full border border-brand-green/20 text-brand-green hover:bg-white transition"
              >
                This Week
              </Link>
              <a
                href={hasData && data!.orderUrl ? data!.orderUrl : "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-bold px-4 py-2 rounded-2xl bg-brand-orange text-white active:scale-[0.985] transition"
              >
                Order Ahead
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-7 pb-16">
        {loading ? (
          <div className="py-10 text-center text-[color:var(--td-ink-muted)]">Loading fresh menu…</div>
        ) : !hasData ? (
          <NoMenuState />
        ) : (
          <>
            {/* Today's info — special, location, hours (from published snapshot) */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block px-3 py-1 text-xs font-bold tracking-[0.2em] rounded-full bg-brand-orange/10 text-brand-orange">
                  TODAY
                </span>
                {data!.special && (
                  <span className="text-xs uppercase tracking-widest text-[color:var(--td-ink-muted)]">
                    Special
                  </span>
                )}
              </div>

              <h1 className="font-display text-[2.1rem] leading-[1.05] tracking-[-1.5px] font-bold text-balance mb-3">
                {data!.special || "Check our board today"}
              </h1>

              <div className="space-y-1 text-[15px]">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-brand-orange">📍</span>
                  <div>
                    <div className="font-medium">{data!.location}</div>
                    <div className="text-[color:var(--td-ink-muted)]">
                      {data!.hoursStart} — {data!.hoursEnd}
                      {data!.phone && (
                        <>
                          {" "}
                          ·{" "}
                          <a
                            href={`tel:${data!.phone.replace(/[^\d]/g, "")}`}
                            className="underline hover:text-brand-orange"
                          >
                            {data!.phone}
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Full Menu */}
            <section>
              <div className="flex items-baseline justify-between mb-3 px-1">
                <h2 className="font-display text-2xl">Menu</h2>
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--td-ink-muted)]">
                  Updated from TruckDash
                </span>
              </div>

              <div className="bg-[color:var(--surface)] rounded-3xl border border-[color:var(--border)] shadow-sm overflow-hidden divide-y divide-[color:var(--border)]">
                {data!.menu.length > 0 ? (
                  data!.menu.map((item: MenuItem, idx: number) => (
                    <div
                      key={item.id || idx}
                      className="flex items-center justify-between px-5 py-[15px] active:bg-brand-sand/60 transition"
                    >
                      <span className="text-[15px] font-medium pr-4 leading-tight">
                        {item.name}
                      </span>
                      <span className="font-bold text-brand-orange tabular-nums shrink-0 text-[15px]">
                        ${item.price}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-5 py-8 text-[color:var(--td-ink-muted)]">
                    Menu items will appear here after publish.
                  </div>
                )}
              </div>

              <p className="mt-3 text-xs text-center text-[color:var(--td-ink-muted)] px-2">
                Prices and availability can change. Call or check with us on site.
              </p>
            </section>

            {/* Subtle Last Updated footer on the menu page (as requested) */}
            {lastUpdated && (
              <div className="mt-8 text-center">
                <p
                  className="text-[10px] text-[color:var(--td-ink-muted)] tracking-[0.5px]"
                  suppressHydrationWarning
                >
                  Last updated from TruckDash:{" "}
                  <span className="font-medium text-[color:var(--td-ink-muted)]">{lastUpdated}</span>
                </p>
              </div>
            )}

            {/* Bottom CTA */}
            <div className="mt-8">
              <a
                href={data!.orderUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center py-4 rounded-3xl bg-brand-green text-white font-bold text-base shadow-lg shadow-brand-green/20 active:scale-[0.985] transition"
              >
                Order Ahead or Call {data!.phone || "Us"}
              </a>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-[color:var(--border)] py-6 text-center text-[10px] text-[color:var(--td-ink-muted)]">
        Authentic Kentucky soul • Lake Cumberland region
        <br />
        <Link to="/schedule" className="underline hover:text-brand-green">
          See this week’s schedule →
        </Link>
      </footer>
    </div>
  );
}

function NoMenuState() {
  return (
    <div className="max-w-md mx-auto pt-10 text-center">
      <div className="mx-auto mb-6 size-16 rounded-full bg-brand-orange/10 flex items-center justify-center text-4xl">
        🍂
      </div>
      <h2 className="font-display text-3xl tracking-tight">Menu coming soon</h2>
      <p className="mt-3 text-[color:var(--td-ink-muted)] leading-relaxed">
        The truck owner hasn’t published their latest menu yet.
        <br />
        Check back after they tap “Publish Updates to My Website” in TruckDash.
      </p>

      <div className="mt-8 bg-[color:var(--surface)] border border-[color:var(--border)] rounded-3xl p-5 text-left text-sm">
        <div className="font-semibold mb-2">For the truck team:</div>
        <p className="text-[color:var(--td-ink-muted)] text-sm">
          Open TruckDash → update your menu or schedule → hit Publish. Your customers will see it
          here right away.
        </p>
      </div>

      <Link
        to="/"
        className="mt-8 inline-block text-sm font-bold text-brand-orange hover:underline"
      >
        Open TruckDash dashboard
      </Link>
    </div>
  );
}
