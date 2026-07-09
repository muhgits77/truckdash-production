/**
 * Live Map — TruckDash operator command center
 *
 * Premium Leaflet map centered on Lake Cumberland / Monticello / Russell Springs /
 * Jamestown KY. Gold teardrop = live pin, deep forest = weekly schedule stops.
 * Theme-aware basemap (warm light / deep forest dark). All state in truck-state.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageShell, TipCard } from "@/components/page-shell";
import { useTheme } from "@/hooks/use-theme";
import { type LiveStop, type ScheduleDay, useTruckState } from "@/lib/truck-state";

export const Route = createFileRoute("/live-map")({
  head: () => ({
    meta: [
      { title: "Live Map — TruckDash" },
      {
        name: "description",
        content:
          "Go live with your GPS pin, map this week's stops, and let locals find your Kentucky food truck.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
        integrity: "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=",
        crossOrigin: "",
      },
    ],
  }),
  component: LiveMapPage,
});

/** Town anchors — Wayne / Russell / Lake Cumberland corridor */
const TOWNS: { name: string; lat: number; lng: number }[] = [
  { name: "Monticello", lat: 36.8298, lng: -84.8491 },
  { name: "Russell Springs", lat: 37.0567, lng: -85.0886 },
  { name: "Jamestown", lat: 36.9848, lng: -85.063 },
  { name: "Lake Cumberland", lat: 36.92, lng: -84.96 },
];

const DAY_ANCHORS: Record<string, { lat: number; lng: number }> = {
  MON: TOWNS[0],
  TUE: TOWNS[0],
  WED: TOWNS[1],
  THU: TOWNS[2],
  FRI: TOWNS[1],
  SAT: TOWNS[3],
  SUN: TOWNS[0],
};

const MAP_CENTER: [number, number] = [36.95, -84.95];
const MAP_ZOOM = 10;

/** Warm light basemap — parchment / soft terrain */
const TILE_LIGHT =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
/** Deep forest night basemap */
const TILE_DARK =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · &copy; <a href="https://carto.com/">CARTO</a>';

/** Elegant teardrop pin (gold = live, deep green = schedule) */
function pinHtml(kind: "live" | "sched", label: string) {
  if (kind === "live") {
    return `
      <div class="td-pin td-pin--live" role="img" aria-label="Live pin">
        <div class="td-pin__badge">Live</div>
        <svg class="td-pin__svg" viewBox="0 0 40 52" width="36" height="46" aria-hidden="true">
          <defs>
            <linearGradient id="goldPin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#e8c36a"/>
              <stop offset="55%" stop-color="#d4a437"/>
              <stop offset="100%" stop-color="#b8722c"/>
            </linearGradient>
            <filter id="pinShadow" x="-30%" y="-10%" width="160%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.35"/>
            </filter>
          </defs>
          <path filter="url(#pinShadow)" fill="url(#goldPin)" stroke="#5c3a14" stroke-width="1.2"
            d="M20 2C11.2 2 4 9.2 4 18c0 11.5 16 30 16 30s16-18.5 16-30C36 9.2 28.8 2 20 2z"/>
          <circle cx="20" cy="18" r="6.5" fill="#fffdf6" stroke="#5c3a14" stroke-width="1"/>
          <circle cx="20" cy="18" r="3.2" fill="#b8722c"/>
        </svg>
      </div>`;
  }
  return `
    <div class="td-pin td-pin--sched" role="img" aria-label="${escapeHtml(label)} stop">
      <div class="td-pin__day">${escapeHtml(label)}</div>
      <svg class="td-pin__svg" viewBox="0 0 40 52" width="30" height="39" aria-hidden="true">
        <defs>
          <linearGradient id="deepPin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2a5240"/>
            <stop offset="100%" stop-color="#14281f"/>
          </linearGradient>
        </defs>
        <path fill="url(#deepPin)" stroke="#0a1812" stroke-width="1.1"
          d="M20 2C11.2 2 4 9.2 4 18c0 11.5 16 30 16 30s16-18.5 16-30C36 9.2 28.8 2 20 2z"
          style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.28))"/>
        <circle cx="20" cy="18" r="5.5" fill="#f5efe1" stroke="#0a1812" stroke-width="0.9"/>
        <circle cx="20" cy="18" r="2.4" fill="#1a3d2e"/>
      </svg>
    </div>`;
}

function LiveMapPage() {
  const [state, setState] = useTruckState();
  const { theme } = useTheme();
  const [label, setLabel] = useState(state.liveSession.label || state.location);
  const [note, setNote] = useState(state.liveSession.note || "");
  const [stopLabel, setStopLabel] = useState("");
  const [stopTime, setStopTime] = useState("");
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const tileRef = useRef<import("leaflet").TileLayer | null>(null);

  const session = state.liveSession;
  const isLive = session.isLive || state.live;

  const weekPins = useMemo(() => {
    return state.schedule
      .filter((d) => !d.closed)
      .map((d) => {
        const a = DAY_ANCHORS[d.day] ?? DAY_ANCHORS.SAT;
        return {
          id: d.id,
          day: d.day,
          title: d.neighborhood || d.spot,
          sub: d.spot,
          hours: d.hoursStart && d.hoursEnd ? `${d.hoursStart} – ${d.hoursEnd}` : "",
          lat: a.lat,
          lng: a.lng,
        };
      });
  }, [state.schedule]);

  const liveCoords: { lat: number; lng: number; label: string } | null =
    session.lat != null && session.lng != null
      ? { lat: session.lat, lng: session.lng, label: session.label || "Live now" }
      : isLive
        ? {
            lat: DAY_ANCHORS.FRI.lat,
            lng: DAY_ANCHORS.FRI.lng,
            label: session.label || state.location || "Live now",
          }
        : null;

  // Init Leaflet once
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    let cancelled = false;

    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !mapEl.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      const map = L.map(mapEl.current, {
        center: MAP_CENTER,
        zoom: MAP_ZOOM,
        zoomControl: true,
        attributionControl: true,
      });

      const isDark = document.documentElement.classList.contains("dark");
      const tile = L.tileLayer(isDark ? TILE_DARK : TILE_LIGHT, {
        attribution: TILE_ATTR,
        subdomains: "abcd",
        maxZoom: 18,
      }).addTo(map);

      const group = L.layerGroup().addTo(map);
      mapRef.current = map;
      layerRef.current = group;
      tileRef.current = tile;

      setTimeout(() => map.invalidateSize(), 80);
      setTimeout(() => map.invalidateSize(), 300);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
        tileRef.current = null;
      }
    };
  }, []);

  // Swap basemap when theme changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    void (async () => {
      const L = await import("leaflet");
      if (tileRef.current) {
        map.removeLayer(tileRef.current);
      }
      const tile = L.tileLayer(theme === "dark" ? TILE_DARK : TILE_LIGHT, {
        attribution: TILE_ATTR,
        subdomains: "abcd",
        maxZoom: 18,
      }).addTo(map);
      tileRef.current = tile;
    })();
  }, [theme]);

  // Redraw pins when schedule / live changes
  useEffect(() => {
    const map = mapRef.current;
    const group = layerRef.current;
    if (!map || !group) return;

    void (async () => {
      const L = await import("leaflet");
      group.clearLayers();

      // Subtle town anchors (no childish blobs)
      for (const t of TOWNS) {
        L.circleMarker([t.lat, t.lng], {
          radius: 2.5,
          color: theme === "dark" ? "#8a9a8e" : "#6a5a42",
          fillColor: theme === "dark" ? "#1c382a" : "#f5efe1",
          fillOpacity: 0.95,
          weight: 1.25,
        })
          .bindTooltip(t.name, {
            permanent: true,
            direction: "top",
            offset: [0, -8],
            className: "td-map-town-label",
          })
          .addTo(group);
      }

      for (const p of weekPins) {
        const icon = L.divIcon({
          className: "td-map-pin-wrap",
          html: pinHtml("sched", p.day),
          iconSize: [40, 52],
          iconAnchor: [20, 48],
          popupAnchor: [0, -44],
        });
        L.marker([p.lat, p.lng], { icon })
          .bindPopup(
            `<div class="td-map-popup"><strong>${escapeHtml(p.day)}</strong><br/>${escapeHtml(
              p.title,
            )}${
              p.sub ? `<br/><span class="td-map-popup__sub">${escapeHtml(p.sub)}</span>` : ""
            }${p.hours ? `<br/><span class="td-map-popup__hrs">${escapeHtml(p.hours)}</span>` : ""}</div>`,
          )
          .addTo(group);
      }

      if (liveCoords) {
        const icon = L.divIcon({
          className: "td-map-pin-wrap",
          html: pinHtml("live", "Live"),
          iconSize: [48, 60],
          iconAnchor: [24, 54],
          popupAnchor: [0, -50],
        });
        L.marker([liveCoords.lat, liveCoords.lng], { icon, zIndexOffset: 1000 })
          .bindPopup(
            `<div class="td-map-popup"><strong>Live Now</strong><br/>${escapeHtml(
              liveCoords.label,
            )}</div>`,
          )
          .addTo(group);

        // Soft gold pulse ring under live pin
        L.circleMarker([liveCoords.lat, liveCoords.lng], {
          radius: 18,
          color: "#d4a437",
          fillColor: "#d4a437",
          fillOpacity: 0.12,
          weight: 1.5,
          opacity: 0.55,
          className: "td-live-ring",
        }).addTo(group);
      }

      const pts: [number, number][] = weekPins.map((p) => [p.lat, p.lng]);
      if (liveCoords) pts.push([liveCoords.lat, liveCoords.lng]);
      if (pts.length >= 2) {
        map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 12 });
      } else if (pts.length === 1) {
        map.setView(pts[0], 12);
      } else {
        map.setView(MAP_CENTER, MAP_ZOOM);
      }
    })();
  }, [weekPins, liveCoords, theme]);

  const goLive = async () => {
    setBusy(true);
    setGeoMsg(null);
    const apply = (lat: number | null, lng: number | null, geoNote?: string) => {
      const now = new Date().toISOString();
      const locLabel = label.trim() || state.location || "On the road";
      setState({
        ...state,
        live: true,
        location: locLabel,
        liveSession: {
          isLive: true,
          label: locLabel,
          note: note.trim(),
          lat,
          lng,
          updatedAt: now,
        },
      });
      if (geoNote) setGeoMsg(geoNote);
      if (lat != null && lng != null && mapRef.current) {
        mapRef.current.setView([lat, lng], 13, { animate: true });
      }
      setBusy(false);
    };

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          apply(pos.coords.latitude, pos.coords.longitude, "GPS pin set — you're live.");
        },
        () => {
          apply(null, null, "GPS unavailable — live without coordinates. Add a label above.");
        },
        { enableHighAccuracy: true, timeout: 12000 },
      );
    } else {
      apply(null, null, "GPS not supported in this browser.");
    }
  };

  const endSession = () => {
    setState({
      ...state,
      live: false,
      liveSession: {
        ...state.liveSession,
        isLive: false,
        updatedAt: new Date().toISOString(),
      },
    });
    setGeoMsg("Session ended. Locals won't see a Live pin until you go live again.");
  };

  const addStop = () => {
    if (!stopLabel.trim()) return;
    const stop: LiveStop = {
      id: crypto.randomUUID(),
      label: stopLabel.trim(),
      time: stopTime.trim(),
      lat: null,
      lng: null,
    };
    setState({ ...state, liveStops: [...state.liveStops, stop] });
    setStopLabel("");
    setStopTime("");
  };

  const removeStop = (id: string) => {
    setState({ ...state, liveStops: state.liveStops.filter((s) => s.id !== id) });
  };

  return (
    <PageShell title="Live Map" eyebrow="Command center" live={isLive}>
      <TipCard>
        <p className="td-section-label mb-1.5">How to use Live Map</p>
        <p className="text-sm leading-relaxed text-[color:var(--td-ink)]">
          Flip <strong>Go Live</strong> when you park. A gold pin marks you. Deep green pins are
          this week&apos;s stops from{" "}
          <Link to="/this-week" className="text-brand-orange font-semibold underline">
            This Week
          </Link>
          .
        </p>
      </TipCard>

      <section className="td-card overflow-hidden">
        <div
          ref={mapEl}
          className="td-leaflet-map w-full h-[min(54vh,340px)] min-h-[260px] bg-[#e8e2d4] dark:bg-[#0c1c15] z-0"
          role="application"
          aria-label="Interactive map of Lake Cumberland area food truck stops"
        />

        {/* Legend strip */}
        <div className="flex flex-wrap items-center gap-4 px-5 py-3 border-t border-[color:var(--border)] bg-[color:var(--surface-2)]">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--td-ink)]">
            <span className="size-2.5 rounded-full bg-[#d4a437] shadow-[0_0_0_3px_rgba(212,164,55,0.25)]" />
            Live pin
          </span>
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--td-ink)]">
            <span className="size-2.5 rounded-full bg-[#1a3d2e] dark:bg-[#c5d9cc] border border-black/10" />
            Week stop
          </span>
          <span className="text-[11px] text-[color:var(--td-ink-muted)] ml-auto">
            Lake Cumberland · KY
          </span>
        </div>

        <div className="p-5 sm:p-6 space-y-5 border-t border-[color:var(--border)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg tracking-tight text-[color:var(--td-ink)]">
                Live Now
              </h2>
              <p className="text-sm text-[color:var(--td-ink-muted)] mt-1.5 leading-relaxed">
                Show customers you&apos;re open and where to find you.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isLive}
              disabled={busy}
              onClick={() => (isLive ? endSession() : void goLive())}
              className={`shrink-0 w-14 h-8 rounded-full transition relative ${
                isLive ? "bg-brand-orange" : "bg-black/10 dark:bg-white/15"
              }`}
            >
              <span
                className={`absolute top-1 size-6 rounded-full bg-white shadow transition ${
                  isLive ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>

          <label className="block space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--td-ink-muted)]">
              Arriving / open at
            </span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Monticello Market · Courthouse Square"
              className="td-input"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--td-ink-muted)]">
              Quick note
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. brisket sold out, til 8pm"
              className="td-input"
            />
          </label>

          <div className="flex flex-col gap-3 pt-0.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void goLive()}
              className="w-full py-3.5 rounded-2xl bg-brand-orange text-white font-bold text-sm shadow-lg shadow-brand-orange/20 disabled:opacity-60"
            >
              {busy ? "Getting GPS…" : isLive ? "Update live pin" : "Go Live + GPS"}
            </button>
            {isLive && (
              <button
                type="button"
                onClick={endSession}
                className="w-full py-3.5 rounded-2xl border border-[color:var(--border)] text-sm font-bold text-[color:var(--td-ink)] bg-[color:var(--surface)]"
              >
                End session
              </button>
            )}
          </div>
          {geoMsg && (
            <p className="text-sm text-[color:var(--td-ink-muted)] leading-relaxed" role="status">
              {geoMsg}
            </p>
          )}
          {session.updatedAt && (
            <p className="text-xs text-[color:var(--td-ink-muted)]">
              Last change: {new Date(session.updatedAt).toLocaleString()}
              {session.lat != null &&
                ` · ${session.lat.toFixed(4)}, ${session.lng?.toFixed(4)}`}
            </p>
          )}
        </div>
      </section>

      {/* Stops today — full-width stacked, generous padding, no overlaps */}
      <section className="td-card td-card-pad space-y-5">
        <div className="space-y-1.5">
          <h2 className="font-display text-lg tracking-tight text-[color:var(--td-ink)]">
            Stops today
          </h2>
          <p className="text-sm text-[color:var(--td-ink-muted)] leading-relaxed">
            Multi-stop days — add locations if you&apos;re moving around.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <input
            value={stopLabel}
            onChange={(e) => setStopLabel(e.target.value)}
            placeholder="Label (e.g. Town Square)"
            className="td-input"
          />
          <input
            value={stopTime}
            onChange={(e) => setStopTime(e.target.value)}
            placeholder="Hours (e.g. 11am–2pm)"
            className="td-input"
          />
          <button
            type="button"
            onClick={addStop}
            className="w-full rounded-xl bg-brand-deep text-white dark:bg-[#c5d9cc] dark:text-[#0f2419] font-bold text-sm py-3.5"
          >
            + Add stop
          </button>
        </div>

        <ul className="rounded-2xl border border-[color:var(--border)] overflow-hidden divide-y divide-[color:var(--border)]">
          {state.liveStops.length === 0 && (
            <li className="px-4 py-5 text-sm text-[color:var(--td-ink-muted)] leading-relaxed">
              No extra stops yet.
            </li>
          )}
          {state.liveStops.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-4 px-4 py-4 text-sm bg-[color:var(--surface)]"
            >
              <span className="min-w-0">
                <span className="font-semibold text-[color:var(--td-ink)]">{s.label}</span>
                {s.time && (
                  <span className="text-[color:var(--td-ink-muted)]"> · {s.time}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => removeStop(s.id)}
                className="text-xs font-bold text-brand-orange shrink-0 px-2 py-1"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="td-card td-card-pad space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg tracking-tight text-[color:var(--td-ink)]">
            This week on the map
          </h2>
          <Link to="/this-week" className="text-xs font-bold text-brand-orange shrink-0">
            Edit schedule →
          </Link>
        </div>
        <WeekStopList schedule={state.schedule} />
      </section>
    </PageShell>
  );
}

function WeekStopList({ schedule }: { schedule: ScheduleDay[] }) {
  return (
    <ul className="divide-y divide-[color:var(--border)]">
      {schedule.map((d) => (
        <li
          key={d.id}
          className={`flex justify-between gap-4 py-3.5 text-sm first:pt-0 last:pb-0 ${
            d.closed ? "opacity-60" : ""
          }`}
        >
          <span className="min-w-0">
            <span className="font-bold text-brand-orange w-10 inline-block tabular-nums">
              {d.day}
            </span>
            {d.closed ? (
              <span className="text-[color:var(--td-ink-muted)]">{d.note || "Closed"}</span>
            ) : (
              <span className="text-[color:var(--td-ink)] font-medium">
                {d.neighborhood}
                {d.spot ? (
                  <span className="text-[color:var(--td-ink-muted)] font-normal">
                    {" "}
                    · {d.spot}
                  </span>
                ) : null}
              </span>
            )}
          </span>
          {!d.closed && d.hoursStart && (
            <span className="text-xs font-medium text-[color:var(--td-ink-muted)] shrink-0 tabular-nums pt-0.5">
              {d.hoursStart}–{d.hoursEnd}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
