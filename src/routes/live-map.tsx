/**
 * Live Map — Smart Dynamic Map (TruckDash command center)
 *
 * Leaflet + OpenStreetMap. Auto-geocodes This Week schedule + Stops today
 * using a curated Lake Cumberland / KY landmark catalog, then Nominatim.
 * Gold pulsing pin = Live Now · Deep forest pins = schedule · Amber = today stops.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageShell, TipCard } from "@/components/page-shell";
import { BuyFullVersionButton } from "@/components/buy-full-version-button";
import { DemoInlineNotice } from "@/components/demo-banner";
import { useTheme } from "@/hooks/use-theme";
import { useDemoGuard } from "@/hooks/use-demo-guard";
import { DEMO_FEATURE_MESSAGES, isDemoMode } from "@/lib/demo-mode";
import {
  buildScheduleQuery,
  geocodePlace,
  geocodeScheduleDay,
  KY_MAP_CENTER,
  KY_MAP_ZOOM,
  KY_TOWNS,
  type GeoPoint,
} from "@/lib/geocode-ky";
import { type LiveStop, type ScheduleDay, useTruckState } from "@/lib/truck-state";

export const Route = createFileRoute("/live-map")({
  head: () => ({
    meta: [
      { title: "Live Map — TruckDash" },
      {
        name: "description",
        content:
          "Smart map of Lake Cumberland food truck stops. Go live with GPS, auto-pin This Week & multi-stop days.",
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

/** OpenStreetMap standard tiles (light) + CARTO dark (readable night) */
const TILE_LIGHT = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTR_LIGHT =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const TILE_ATTR_DARK =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · &copy; <a href="https://carto.com/">CARTO</a>';

type ResolvedPin = {
  id: string;
  kind: "schedule" | "today" | "live";
  day?: string;
  title: string;
  sub?: string;
  hours?: string;
  lat: number;
  lng: number;
  source?: GeoPoint["source"];
};

function pinHtml(kind: "live" | "sched" | "today", label: string) {
  if (kind === "live") {
    return `
      <div class="td-pin td-pin--live" role="img" aria-label="Live pin">
        <div class="td-pin__badge">Live</div>
        <svg class="td-pin__svg" viewBox="0 0 40 52" width="38" height="48" aria-hidden="true">
          <defs>
            <linearGradient id="goldPin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#e8c36a"/>
              <stop offset="55%" stop-color="#d4a437"/>
              <stop offset="100%" stop-color="#b8722c"/>
            </linearGradient>
            <filter id="pinShadow" x="-30%" y="-10%" width="160%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-color="#000" flood-opacity="0.38"/>
            </filter>
          </defs>
          <path filter="url(#pinShadow)" fill="url(#goldPin)" stroke="#5c3a14" stroke-width="1.2"
            d="M20 2C11.2 2 4 9.2 4 18c0 11.5 16 30 16 30s16-18.5 16-30C36 9.2 28.8 2 20 2z"/>
          <circle cx="20" cy="18" r="6.5" fill="#fffdf6" stroke="#5c3a14" stroke-width="1"/>
          <circle cx="20" cy="18" r="3.2" fill="#b8722c"/>
        </svg>
      </div>`;
  }
  if (kind === "today") {
    return `
      <div class="td-pin td-pin--today" role="img" aria-label="Today stop">
        <div class="td-pin__day td-pin__day--amber">${escapeHtml(label.slice(0, 14))}</div>
        <svg class="td-pin__svg" viewBox="0 0 40 52" width="30" height="39" aria-hidden="true">
          <path fill="#8b5a2b" stroke="#3d2410" stroke-width="1.1"
            d="M20 2C11.2 2 4 9.2 4 18c0 11.5 16 30 16 30s16-18.5 16-30C36 9.2 28.8 2 20 2z"
            style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.28))"/>
          <circle cx="20" cy="18" r="5.5" fill="#f5efe1" stroke="#3d2410" stroke-width="0.9"/>
          <circle cx="20" cy="18" r="2.4" fill="#d4a437"/>
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
  const { allowOrToast, DemoToast } = useDemoGuard();
  const [label, setLabel] = useState(state.liveSession.label || state.location);
  const [note, setNote] = useState(state.liveSession.note || "");
  const [stopLabel, setStopLabel] = useState("");
  const [stopTime, setStopTime] = useState("");
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addingStop, setAddingStop] = useState(false);
  const [mapStatus, setMapStatus] = useState<string>("Resolving locations…");
  const [pins, setPins] = useState<ResolvedPin[]>([]);
  const [geocodeBusy, setGeocodeBusy] = useState(false);

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const tileRef = useRef<import("leaflet").TileLayer | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const session = state.liveSession;
  const isLive = session.isLive || state.live;

  // ── Smart geocode: schedule + live stops + live session label ──────────
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setGeocodeBusy(true);
      setMapStatus("Placing pins from This Week & stops…");
      const nextPins: ResolvedPin[] = [];
      const scheduleUpdates: ScheduleDay[] = [];
      let scheduleDirty = false;
      const stopUpdates: LiveStop[] = [];
      let stopsDirty = false;

      const openDays = state.schedule.filter((d) => !d.closed);
      for (const d of openDays) {
        const q = buildScheduleQuery(d.neighborhood, d.spot);
        if (!q) continue;
        const pt = await geocodeScheduleDay(d);
        if (cancelled) return;
        if (!pt) continue;

        nextPins.push({
          id: d.id,
          kind: "schedule",
          day: d.day,
          title: d.neighborhood || d.spot,
          sub: d.spot,
          hours: d.hoursStart && d.hoursEnd ? `${d.hoursStart} – ${d.hoursEnd}` : "",
          lat: pt.lat,
          lng: pt.lng,
          source: pt.source,
        });

        if (d.lat !== pt.lat || d.lng !== pt.lng || d.geoQuery !== q) {
          scheduleDirty = true;
          scheduleUpdates.push({
            ...d,
            lat: pt.lat,
            lng: pt.lng,
            geoQuery: q,
          });
        } else {
          scheduleUpdates.push(d);
        }
      }

      for (const s of state.liveStops) {
        if (s.lat != null && s.lng != null) {
          nextPins.push({
            id: s.id,
            kind: "today",
            title: s.label,
            hours: s.time,
            lat: s.lat,
            lng: s.lng,
            source: "cache",
          });
          stopUpdates.push(s);
          continue;
        }
        const pt = await geocodePlace(s.label, { allowFallback: true });
        if (cancelled) return;
        if (pt) {
          nextPins.push({
            id: s.id,
            kind: "today",
            title: s.label,
            hours: s.time,
            lat: pt.lat,
            lng: pt.lng,
            source: pt.source,
          });
          stopsDirty = true;
          stopUpdates.push({ ...s, lat: pt.lat, lng: pt.lng });
        } else {
          stopUpdates.push(s);
        }
      }

      // Single persist pass — avoid overwriting mid-flight updates
      if (scheduleDirty || stopsDirty) {
        const cur = stateRef.current;
        const byId = new Map(scheduleUpdates.map((x) => [x.id, x]));
        setState({
          ...cur,
          schedule: scheduleDirty ? cur.schedule.map((d) => byId.get(d.id) ?? d) : cur.schedule,
          liveStops: stopsDirty ? stopUpdates : cur.liveStops,
        });
      }

      // Live pin from GPS or geocoded label
      if (isLive) {
        if (session.lat != null && session.lng != null) {
          nextPins.push({
            id: "live",
            kind: "live",
            title: session.label || state.location || "Live now",
            lat: session.lat,
            lng: session.lng,
            source: "cache",
          });
        } else {
          const liveQ = session.label || label || state.location;
          if (liveQ) {
            const pt = await geocodePlace(liveQ, { allowFallback: true });
            if (cancelled) return;
            if (pt) {
              nextPins.push({
                id: "live",
                kind: "live",
                title: liveQ,
                lat: pt.lat,
                lng: pt.lng,
                source: pt.source,
              });
            }
          }
        }
      }

      if (cancelled) return;
      setPins(nextPins);
      const n = nextPins.length;
      setMapStatus(
        n === 0
          ? "No mappable stops yet — edit This Week or add a stop."
          : `${n} pin${n === 1 ? "" : "s"} · Lake Cumberland corridor`,
      );
      setGeocodeBusy(false);
    })();

    return () => {
      cancelled = true;
    };
    // Re-run when location text / stops / live change
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional selective deps
  }, [
    state.schedule.map((d) => `${d.id}|${d.closed}|${d.neighborhood}|${d.spot}`).join(";"),
    state.liveStops.map((s) => `${s.id}|${s.label}|${s.lat}|${s.lng}`).join(";"),
    isLive,
    session.lat,
    session.lng,
    session.label,
    state.location,
  ]);

  // ── Init Leaflet once ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    let cancelled = false;

    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !mapEl.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      const map = L.map(mapEl.current, {
        center: KY_MAP_CENTER,
        zoom: KY_MAP_ZOOM,
        zoomControl: true,
        attributionControl: true,
      });

      const isDark = document.documentElement.classList.contains("dark");
      const tile = L.tileLayer(isDark ? TILE_DARK : TILE_LIGHT, {
        attribution: isDark ? TILE_ATTR_DARK : TILE_ATTR_LIGHT,
        subdomains: isDark ? "abcd" : "abc",
        maxZoom: 19,
      }).addTo(map);

      const group = L.layerGroup().addTo(map);
      mapRef.current = map;
      layerRef.current = group;
      tileRef.current = tile;

      setTimeout(() => map.invalidateSize(), 80);
      setTimeout(() => map.invalidateSize(), 320);
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

  // Theme basemap swap
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    void (async () => {
      const L = await import("leaflet");
      if (tileRef.current) map.removeLayer(tileRef.current);
      const dark = theme === "dark";
      const tile = L.tileLayer(dark ? TILE_DARK : TILE_LIGHT, {
        attribution: dark ? TILE_ATTR_DARK : TILE_ATTR_LIGHT,
        subdomains: dark ? "abcd" : "abc",
        maxZoom: 19,
      }).addTo(map);
      tileRef.current = tile;
    })();
  }, [theme]);

  // Draw pins
  useEffect(() => {
    const map = mapRef.current;
    const group = layerRef.current;
    if (!map || !group) return;

    void (async () => {
      const L = await import("leaflet");
      group.clearLayers();

      for (const t of KY_TOWNS) {
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

      for (const p of pins) {
        if (p.kind === "live") continue; // drawn last on top
        const isToday = p.kind === "today";
        const icon = L.divIcon({
          className: "td-map-pin-wrap",
          html: pinHtml(isToday ? "today" : "sched", p.day || p.title.slice(0, 12)),
          iconSize: [40, 52],
          iconAnchor: [20, 48],
          popupAnchor: [0, -44],
        });
        L.marker([p.lat, p.lng], { icon, zIndexOffset: isToday ? 400 : 200 })
          .bindPopup(
            `<div class="td-map-popup"><strong>${escapeHtml(
              p.day || (isToday ? "Today" : "Stop"),
            )}</strong><br/>${escapeHtml(p.title)}${
              p.sub ? `<br/><span class="td-map-popup__sub">${escapeHtml(p.sub)}</span>` : ""
            }${
              p.hours ? `<br/><span class="td-map-popup__hrs">${escapeHtml(p.hours)}</span>` : ""
            }${
              p.source
                ? `<br/><span class="td-map-popup__hrs" style="opacity:.65">via ${escapeHtml(p.source)}</span>`
                : ""
            }</div>`,
          )
          .addTo(group);
      }

      const live = pins.find((p) => p.kind === "live");
      if (live) {
        L.circleMarker([live.lat, live.lng], {
          radius: 20,
          color: "#d4a437",
          fillColor: "#d4a437",
          fillOpacity: 0.14,
          weight: 1.5,
          opacity: 0.6,
        }).addTo(group);

        const icon = L.divIcon({
          className: "td-map-pin-wrap",
          html: pinHtml("live", "Live"),
          iconSize: [48, 62],
          iconAnchor: [24, 56],
          popupAnchor: [0, -52],
        });
        L.marker([live.lat, live.lng], { icon, zIndexOffset: 1000 })
          .bindPopup(
            `<div class="td-map-popup"><strong>Live Now</strong><br/>${escapeHtml(
              live.title,
            )}</div>`,
          )
          .addTo(group);
      }

      const pts: [number, number][] = pins.map((p) => [p.lat, p.lng]);
      if (pts.length >= 2) {
        map.fitBounds(L.latLngBounds(pts), { padding: [44, 44], maxZoom: 13 });
      } else if (pts.length === 1) {
        map.setView(pts[0], 13);
      } else {
        map.setView(KY_MAP_CENTER, KY_MAP_ZOOM);
      }
    })();
  }, [pins, theme]);

  const goLive = useCallback(async () => {
    if (!allowOrToast("map_edit")) return;
    setBusy(true);
    setGeoMsg(null);
    const locLabel = label.trim() || state.location || "On the road";

    const finish = (lat: number | null, lng: number | null, msg: string) => {
      setState({
        ...stateRef.current,
        live: true,
        location: locLabel,
        liveSession: {
          isLive: true,
          label: locLabel,
          note: note.trim(),
          lat,
          lng,
          updatedAt: new Date().toISOString(),
        },
      });
      setGeoMsg(msg);
      if (lat != null && lng != null && mapRef.current) {
        mapRef.current.setView([lat, lng], 14, { animate: true });
      }
      setBusy(false);
    };

    // Prefer device GPS
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          finish(
            pos.coords.latitude,
            pos.coords.longitude,
            "GPS pin set — you're live on the map.",
          );
        },
        async () => {
          // Fallback: geocode the label
          const pt = await geocodePlace(locLabel, { allowFallback: true });
          if (pt) {
            finish(pt.lat, pt.lng, `GPS unavailable — pinned via “${pt.label}”.`);
          } else {
            finish(
              null,
              null,
              "GPS unavailable and location not found. Try a clearer KY place name.",
            );
          }
        },
        { enableHighAccuracy: true, timeout: 12000 },
      );
    } else {
      const pt = await geocodePlace(locLabel, { allowFallback: true });
      if (pt) finish(pt.lat, pt.lng, `Pinned via “${pt.label}”.`);
      else finish(null, null, "Could not resolve location. Add a clearer place name.");
    }
  }, [label, note, state.location, setState, allowOrToast]);

  const endSession = () => {
    if (isDemoMode) {
      allowOrToast("map_edit");
      return;
    }
    setState({
      ...state,
      live: false,
      liveSession: {
        ...state.liveSession,
        isLive: false,
        updatedAt: new Date().toISOString(),
      },
    });
    setGeoMsg("Session ended. Live pin removed until you go live again.");
  };

  const addStop = async () => {
    if (!allowOrToast("map_edit")) return;
    if (!stopLabel.trim() || addingStop) return;
    setAddingStop(true);
    setGeoMsg(null);
    const labelText = stopLabel.trim();
    const timeText = stopTime.trim();
    const pt = await geocodePlace(labelText, { allowFallback: true });
    const stop: LiveStop = {
      id: crypto.randomUUID(),
      label: labelText,
      time: timeText,
      lat: pt?.lat ?? null,
      lng: pt?.lng ?? null,
    };
    setState({ ...stateRef.current, liveStops: [...stateRef.current.liveStops, stop] });
    setStopLabel("");
    setStopTime("");
    if (pt) {
      setGeoMsg(`Stop pinned: ${pt.label}`);
      if (mapRef.current) mapRef.current.setView([pt.lat, pt.lng], 13, { animate: true });
    } else {
      setGeoMsg(
        "Stop saved, but no map match yet. Try names like “Russell Springs Main St” or “State Dock”.",
      );
    }
    setAddingStop(false);
  };

  const removeStop = (id: string) => {
    if (!allowOrToast("map_edit")) return;
    setState({ ...state, liveStops: state.liveStops.filter((s) => s.id !== id) });
  };

  const scheduleSource = (id: string) => pins.find((p) => p.id === id)?.source;

  return (
    <PageShell title="Live Map" eyebrow="Command center" live={isLive} pro>
      {isDemoMode && <DemoInlineNotice message={DEMO_FEATURE_MESSAGES.map_edit} />}

      <TipCard>
        <p className="td-section-label mb-1.5">Smart Map</p>
        <p className="text-sm leading-relaxed text-[color:var(--td-ink)]">
          Pins auto-place from{" "}
          <Link to="/this-week" className="text-brand-orange font-semibold underline">
            This Week
          </Link>{" "}
          and Stops today using real Kentucky places (Monticello, Russell Springs, Jamestown, Lake
          Cumberland).{" "}
          {isDemoMode ? (
            <>Browse pins in demo — full GPS &amp; stop editing unlocks with the full version.</>
          ) : (
            <>
              <strong>Go Live</strong> drops a gold GPS pin.
            </>
          )}
        </p>
      </TipCard>

      <section className="td-card overflow-hidden pro-feature-surface">
        <div
          ref={mapEl}
          className="td-leaflet-map w-full h-[min(56vh,360px)] min-h-[280px] bg-[#e8e2d4] dark:bg-[#0c1c15] z-0"
          role="application"
          aria-label="Interactive OpenStreetMap of Lake Cumberland area food truck stops"
        />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 border-t border-[color:var(--border)] bg-[color:var(--surface-2)]">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--td-ink)]">
            <span className="size-2.5 rounded-full bg-[#d4a437] shadow-[0_0_0_3px_rgba(212,164,55,0.28)] animate-pulse" />
            Live
          </span>
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--td-ink)]">
            <span className="size-2.5 rounded-full bg-[#1a3d2e] dark:bg-[#c5d9cc]" />
            This Week
          </span>
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--td-ink)]">
            <span className="size-2.5 rounded-full bg-[#8b5a2b]" />
            Today
          </span>
          <span
            className="text-[11px] text-[color:var(--td-ink-muted)] ml-auto tabular-nums"
            role="status"
          >
            {geocodeBusy ? "Geocoding…" : mapStatus}
          </span>
        </div>

        <div className="p-5 sm:p-6 space-y-5 border-t border-[color:var(--border)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg tracking-tight text-[color:var(--td-ink)]">
                Live Now
              </h2>
              <p className="text-sm text-[color:var(--td-ink-muted)] mt-1.5 leading-relaxed">
                GPS first — if denied, we geocode your label to a KY pin.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isLive}
              disabled={busy || isDemoMode}
              onClick={() => (isLive ? endSession() : void goLive())}
              className={`shrink-0 w-14 h-8 rounded-full transition relative ${
                isLive ? "bg-brand-orange" : "bg-black/10 dark:bg-white/15"
              } ${isDemoMode ? "opacity-55 cursor-not-allowed" : ""}`}
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
              placeholder="e.g. Russell Springs Main St. Lot"
              className="td-input"
              disabled={isDemoMode}
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
              disabled={isDemoMode}
            />
          </label>

          <div className="flex flex-col gap-3">
            {isDemoMode ? (
              <BuyFullVersionButton size="lg" />
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void goLive()}
                className="w-full py-3.5 rounded-2xl bg-brand-orange text-white font-bold text-sm shadow-lg shadow-brand-orange/20 disabled:opacity-60"
              >
                {busy ? "Getting location…" : isLive ? "Update live pin" : "Go Live + GPS"}
              </button>
            )}
            {isLive && !isDemoMode && (
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
              {session.lat != null && ` · ${session.lat.toFixed(4)}, ${session.lng?.toFixed(4)}`}
            </p>
          )}
        </div>
      </section>

      {/* Stops today — geocoded on add */}
      <section className="td-card td-card-pad space-y-5">
        <div className="space-y-1.5">
          <h2 className="font-display text-lg tracking-tight text-[color:var(--td-ink)]">
            Stops today
          </h2>
          <p className="text-sm text-[color:var(--td-ink-muted)] leading-relaxed">
            Type a real place (e.g. “State Dock”, “Jamestown Lakeway”) — we pin it automatically.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <input
            value={stopLabel}
            onChange={(e) => setStopLabel(e.target.value)}
            placeholder="Place (e.g. Courthouse Square Monticello)"
            className="td-input"
            disabled={isDemoMode}
            onKeyDown={(e) => {
              if (e.key === "Enter") void addStop();
            }}
          />
          <input
            value={stopTime}
            onChange={(e) => setStopTime(e.target.value)}
            placeholder="Hours (e.g. 11am–2pm)"
            className="td-input"
            disabled={isDemoMode}
          />
          {isDemoMode ? (
            <BuyFullVersionButton size="lg" />
          ) : (
            <button
              type="button"
              onClick={() => void addStop()}
              disabled={addingStop || !stopLabel.trim()}
              className="w-full rounded-xl bg-brand-deep text-white dark:bg-[#c5d9cc] dark:text-[#0f2419] font-bold text-sm py-3.5 disabled:opacity-55"
            >
              {addingStop ? "Finding on map…" : "+ Add stop & pin"}
            </button>
          )}
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
                {s.time && <span className="text-[color:var(--td-ink-muted)]"> · {s.time}</span>}
                <span className="block text-[10px] mt-1 text-[color:var(--td-ink-muted)]">
                  {s.lat != null
                    ? `Pinned · ${s.lat.toFixed(3)}, ${s.lng?.toFixed(3)}`
                    : "No pin yet"}
                </span>
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
        <WeekStopList schedule={state.schedule} sourceOf={scheduleSource} />
      </section>
      <DemoToast />
    </PageShell>
  );
}

function WeekStopList({
  schedule,
  sourceOf,
}: {
  schedule: ScheduleDay[];
  sourceOf: (id: string) => string | undefined;
}) {
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
                  <span className="text-[color:var(--td-ink-muted)] font-normal"> · {d.spot}</span>
                ) : null}
                {(d.lat != null || sourceOf(d.id)) && (
                  <span className="block text-[10px] font-normal text-[color:var(--td-ink-muted)] mt-0.5 pl-10">
                    {d.lat != null
                      ? `Map · ${d.lat.toFixed(3)}, ${d.lng?.toFixed(3)}`
                      : "Locating…"}
                    {sourceOf(d.id) ? ` · ${sourceOf(d.id)}` : ""}
                  </span>
                )}
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
