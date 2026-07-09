/**
 * Live Map — TruckDash operator command center
 *
 * Premium SVG regional map (Lake Cumberland / Monticello / Russell Springs / Jamestown).
 * Leaflet-ready pin coordinates (% of map). Go Live + multi-stop list.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageShell, TipCard } from "@/components/page-shell";
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
  }),
  component: LiveMapPage,
});

/** Map viewBox 0–100 (percent-friendly) */
const MAP = {
  latMax: 37.12,
  latMin: 36.72,
  lngMin: -85.15,
  lngMax: -84.7,
};

function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - MAP.lngMin) / (MAP.lngMax - MAP.lngMin)) * 100;
  const y = ((MAP.latMax - lat) / (MAP.latMax - MAP.latMin)) * 100;
  return {
    x: Math.min(94, Math.max(6, x)),
    y: Math.min(92, Math.max(8, y)),
  };
}

/** Accurate-ish anchors for Wayne / Russell / lake corridor */
const DAY_ANCHORS: Record<string, { lat: number; lng: number }> = {
  MON: { lat: 36.83, lng: -84.85 },
  TUE: { lat: 36.83, lng: -84.85 }, // Monticello
  WED: { lat: 37.05, lng: -85.08 }, // Russell Springs
  THU: { lat: 36.98, lng: -85.06 }, // Jamestown
  FRI: { lat: 37.05, lng: -85.08 },
  SAT: { lat: 36.92, lng: -84.95 }, // Lake Cumberland
  SUN: { lat: 36.83, lng: -84.85 },
};

const TOWNS = [
  { name: "Monticello", lat: 36.83, lng: -84.85 },
  { name: "Russell Springs", lat: 37.055, lng: -85.08 },
  { name: "Jamestown", lat: 36.985, lng: -85.065 },
  { name: "Lake Cumberland", lat: 36.91, lng: -84.94 },
] as const;

function LiveMapPage() {
  const [state, setState] = useTruckState();
  const [label, setLabel] = useState(state.liveSession.label || state.location);
  const [note, setNote] = useState(state.liveSession.note || "");
  const [stopLabel, setStopLabel] = useState("");
  const [stopTime, setStopTime] = useState("");
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const session = state.liveSession;
  const isLive = session.isLive || state.live;

  const weekPins = useMemo(() => {
    return state.schedule
      .filter((d) => !d.closed)
      .map((d) => {
        const anchor = DAY_ANCHORS[d.day] ?? DAY_ANCHORS.SAT;
        return {
          id: d.id,
          day: d.day,
          title: d.neighborhood || d.spot,
          lat: anchor.lat,
          lng: anchor.lng,
        };
      });
  }, [state.schedule]);

  const livePin =
    session.lat != null && session.lng != null
      ? { lat: session.lat, lng: session.lng, label: session.label || "Live now" }
      : isLive
        ? {
            lat: DAY_ANCHORS.FRI.lat,
            lng: DAY_ANCHORS.FRI.lng,
            label: session.label || state.location || "Live now",
          }
        : null;

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
        <p className="text-sm leading-relaxed text-foreground/80">
          Flip <strong className="text-foreground">Go Live</strong> when you park at the market or
          ramp. Locals see a gold pin. End the session when you pack up. Weekly stops from{" "}
          <Link to="/this-week" className="text-brand-orange font-semibold underline">
            This Week
          </Link>{" "}
          show as map markers.
        </p>
      </TipCard>

      {/* ── Premium regional map ── */}
      <section className="td-card overflow-hidden">
        <div
          className="relative w-full aspect-[5/4] sm:aspect-[4/3] bg-[#e8e2d4] dark:bg-[#1a2e24]"
          role="img"
          aria-label="Map of Lake Cumberland area — Monticello, Russell Springs, Jamestown"
        >
          <RegionalMapSvg />

          {/* Town labels (projected) */}
          {TOWNS.map((t) => {
            const { x, y } = project(t.lat, t.lng);
            return (
              <span
                key={t.name}
                className="absolute z-[5] -translate-x-1/2 pointer-events-none select-none text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.12em] text-[#1a3d2e]/55 dark:text-white/45"
                style={{ left: `${x}%`, top: `${Math.max(4, y - 6)}%` }}
              >
                {t.name}
              </span>
            );
          })}

          {/* Scheduled stop pins — deep green */}
          {weekPins.map((p) => {
            const { x, y } = project(p.lat, p.lng);
            return (
              <div
                key={p.id}
                className="absolute z-10 -translate-x-1/2 -translate-y-[110%]"
                style={{ left: `${x}%`, top: `${y}%` }}
                title={`${p.day}: ${p.title}`}
              >
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[9px] font-bold tracking-wide bg-white dark:bg-[#173024] text-[#1a3d2e] dark:text-[#e8f0ea] px-1.5 py-0.5 rounded-md shadow-sm border border-black/8 dark:border-white/15">
                    {p.day}
                  </span>
                  <span className="relative flex size-3.5 items-center justify-center">
                    <span className="absolute size-3.5 rounded-full bg-[#1a3d2e]/20 dark:bg-white/15" />
                    <span className="size-2.5 rounded-full bg-[#1a3d2e] dark:bg-[#c5d9cc] border-2 border-white dark:border-[#0f2419] shadow" />
                  </span>
                </div>
              </div>
            );
          })}

          {/* Live pin — bourbon gold + pulse */}
          {livePin && (
            <div
              className="absolute z-20 -translate-x-1/2 -translate-y-[115%]"
              style={{
                left: `${project(livePin.lat, livePin.lng).x}%`,
                top: `${project(livePin.lat, livePin.lng).y}%`,
              }}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold bg-[#b8722c] text-white px-2.5 py-1 rounded-full shadow-md shadow-[#b8722c]/35 whitespace-nowrap">
                  Live Now
                </span>
                <span className="live-pin-pulse size-4 rounded-full bg-[#d4a437] border-2 border-white shadow-lg" />
              </div>
            </div>
          )}

          <div className="absolute bottom-0 inset-x-0 flex justify-between px-3 py-2 bg-gradient-to-t from-black/25 to-transparent text-[9px] font-semibold text-white/90">
            <span>Green = scheduled · Gold = live</span>
            <span>Leaflet-ready coords</span>
          </div>
        </div>

        {/* Live Now controls */}
        <div className="p-5 space-y-4 border-t border-black/5 dark:border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-lg tracking-tight text-foreground">Live Now</h2>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
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

          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Arriving / open at
            </span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Monticello Market · Courthouse Square"
              className="mt-1.5 w-full rounded-xl border border-border bg-muted/40 dark:bg-black/25 px-3.5 py-2.5 text-sm font-medium text-foreground outline-none focus:border-brand-orange"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Quick note
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. brisket sold out, til 8pm"
              className="mt-1.5 w-full rounded-xl border border-border bg-muted/40 dark:bg-black/25 px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-brand-orange"
            />
          </label>

          <div className="flex flex-col gap-2.5 sm:flex-row pt-0.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void goLive()}
              className="flex-1 py-3.5 rounded-2xl bg-brand-orange text-white font-bold text-sm shadow-lg shadow-brand-orange/20 disabled:opacity-60"
            >
              {busy ? "Getting GPS…" : isLive ? "Update live pin" : "Go Live + GPS"}
            </button>
            {isLive && (
              <button
                type="button"
                onClick={endSession}
                className="sm:w-auto px-5 py-3.5 rounded-2xl border border-border text-sm font-bold text-foreground/80 bg-surface"
              >
                End session
              </button>
            )}
          </div>
          {geoMsg && (
            <p className="text-xs text-muted-foreground" role="status">
              {geoMsg}
            </p>
          )}
          {session.updatedAt && (
            <p className="text-[10px] text-muted-foreground/80">
              Last change: {new Date(session.updatedAt).toLocaleString()}
              {session.lat != null &&
                ` · ${session.lat.toFixed(4)}, ${session.lng?.toFixed(4)}`}
            </p>
          )}
        </div>
      </section>

      {/* Stops today — stacked layout, no overflow */}
      <section className="td-card td-card-pad space-y-4">
        <div>
          <h2 className="font-display text-lg tracking-tight text-foreground">Stops today</h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Multi-stop days — add locations if you&apos;re moving around.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          <input
            value={stopLabel}
            onChange={(e) => setStopLabel(e.target.value)}
            placeholder="Label (e.g. Town Square)"
            className="w-full rounded-xl border border-border bg-muted/40 dark:bg-black/25 px-3.5 py-3 text-sm text-foreground outline-none focus:border-brand-orange"
          />
          <div className="grid grid-cols-[1fr_auto] gap-2.5">
            <input
              value={stopTime}
              onChange={(e) => setStopTime(e.target.value)}
              placeholder="Hours (e.g. 11am–2pm)"
              className="w-full min-w-0 rounded-xl border border-border bg-muted/40 dark:bg-black/25 px-3.5 py-3 text-sm text-foreground outline-none focus:border-brand-orange"
            />
            <button
              type="button"
              onClick={addStop}
              className="shrink-0 rounded-xl bg-brand-deep text-white font-bold text-sm px-4 py-3 whitespace-nowrap"
            >
              + Add
            </button>
          </div>
        </div>

        <ul className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
          {state.liveStops.length === 0 && (
            <li className="px-4 py-3.5 text-sm text-muted-foreground">No extra stops yet.</li>
          )}
          {state.liveStops.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 px-4 py-3.5 text-sm bg-surface"
            >
              <span className="min-w-0">
                <span className="font-semibold text-foreground">{s.label}</span>
                {s.time && (
                  <span className="text-muted-foreground"> · {s.time}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => removeStop(s.id)}
                className="text-xs font-bold text-brand-orange shrink-0"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="td-card td-card-pad">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <h2 className="font-display text-lg tracking-tight text-foreground">
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

/**
 * Clean topographic-style SVG of the Lake Cumberland corridor.
 * Not a crayon blob — layered hills, lake, roads, towns.
 * ViewBox 0 0 100 80 for percentage pin overlay.
 */
function RegionalMapSvg() {
  return (
    <svg
      viewBox="0 0 100 80"
      className="absolute inset-0 size-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="skyHill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d4cfc0" />
          <stop offset="55%" stopColor="#c5d0b4" />
          <stop offset="100%" stopColor="#a8b896" />
        </linearGradient>
        <linearGradient id="skyHillDark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e3329" />
          <stop offset="100%" stopColor="#152820" />
        </linearGradient>
        <linearGradient id="lakeGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4a8a96" stopOpacity="0.55" />
          <stop offset="50%" stopColor="#3d7a88" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#2f6570" stopOpacity="0.5" />
        </linearGradient>
        <filter id="soft" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="0.4" />
        </filter>
      </defs>

      {/* Terrain base */}
      <rect width="100" height="80" className="fill-[#d8d2c2] dark:fill-[#152820]" />

      {/* Distant hills */}
      <path
        d="M0 28 Q15 18 28 26 T52 22 T78 28 T100 20 L100 80 L0 80 Z"
        className="fill-[#b8c4a6]/80 dark:fill-[#1f352b]"
      />
      <path
        d="M0 38 Q20 30 40 36 T70 32 T100 40 L100 80 L0 80 Z"
        className="fill-[#a8b896]/90 dark:fill-[#243d32]"
      />

      {/* Soft topo contour lines */}
      <g
        fill="none"
        stroke="#1a3d2e"
        strokeOpacity="0.08"
        strokeWidth="0.25"
        className="dark:stroke-white dark:stroke-opacity-10"
      >
        <path d="M5 45 Q25 42 45 46 T85 44" />
        <path d="M8 52 Q30 48 50 53 T90 50" />
        <path d="M10 58 Q35 55 55 59 T92 56" />
        <path d="M12 65 Q40 62 60 66 T95 63" />
      </g>

      {/* Lake Cumberland — elongated reservoir shape */}
      <ellipse
        cx="48"
        cy="48"
        rx="22"
        ry="14"
        fill="url(#lakeGrad)"
        filter="url(#soft)"
        transform="rotate(-18 48 48)"
      />
      <ellipse
        cx="52"
        cy="50"
        rx="14"
        ry="8"
        fill="#5a9aaa"
        fillOpacity="0.25"
        transform="rotate(-12 52 50)"
        className="dark:fill-[#4a8a96] dark:fill-opacity-30"
      />

      {/* KY 90 corridor (simplified road) */}
      <path
        d="M5 62 Q30 58 50 55 T95 52"
        fill="none"
        stroke="#8a7a60"
        strokeWidth="0.9"
        strokeOpacity="0.45"
        strokeLinecap="round"
        className="dark:stroke-white dark:stroke-opacity-20"
      />
      <path
        d="M5 62 Q30 58 50 55 T95 52"
        fill="none"
        stroke="#c4b8a0"
        strokeWidth="0.35"
        strokeOpacity="0.7"
        strokeLinecap="round"
        strokeDasharray="1.2 1.5"
        className="dark:stroke-white dark:stroke-opacity-25"
      />

      {/* Secondary road north–south */}
      <path
        d="M38 12 Q42 35 48 55 T55 78"
        fill="none"
        stroke="#8a7a60"
        strokeWidth="0.55"
        strokeOpacity="0.35"
        strokeLinecap="round"
        className="dark:stroke-white dark:stroke-opacity-15"
      />

      {/* Soft vignette */}
      <rect
        width="100"
        height="80"
        fill="url(#vignette)"
        className="pointer-events-none"
        opacity="0"
      />
    </svg>
  );
}

function WeekStopList({ schedule }: { schedule: ScheduleDay[] }) {
  return (
    <ul className="divide-y divide-border">
      {schedule.map((d) => (
        <li
          key={d.id}
          className={`flex justify-between gap-3 py-2.5 text-sm ${d.closed ? "opacity-50" : ""}`}
        >
          <span className="min-w-0">
            <span className="font-bold text-brand-orange w-9 inline-block">{d.day}</span>
            {d.closed ? (
              <span className="text-muted-foreground">{d.note || "Closed"}</span>
            ) : (
              <span className="text-foreground">
                {d.neighborhood}
                {d.spot ? (
                  <span className="text-muted-foreground"> · {d.spot}</span>
                ) : null}
              </span>
            )}
          </span>
          {!d.closed && d.hoursStart && (
            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
              {d.hoursStart}–{d.hoursEnd}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
