import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { toBlob, toPng } from "html-to-image";
import flyerFood from "@/assets/flyer-food.jpg";
import {
  type MenuItem,
  type ScheduleDay,
  type TruckState,
  type TemplateId,
  type ShareFormat,
  type BackgroundId,
  DEFAULT_SCHEDULE,
  DEFAULT_STATE,
  APP_VERSION,
  STORAGE_KEY,
  VERSION_KEY,
  ONBOARD_KEY,
  useTruckState,
} from "@/lib/truck-state";
import {
  getProfile,
  saveProfile,
  getInquiries,
  markInquiryContacted,
  type CateringProfile,
  type CateringInquiry,
} from "@/lib/dataService";
import {
  publishData,
  getPublishedData,
  exportPublishedJSON,
  buildPublishPayloadFromState,
  isSupabaseSyncEnabled,
  setSupabaseSyncEnabled,
  getConfiguredTruckId,
  setConfiguredTruckId,
  canUseSupabaseSync,
  hasPendingCloudSync,
  flushPendingCloudSync,
  getOwnerSessionEmail,
  signInOwner,
  signUpOwner,
  signOutOwner,
  DEFAULT_TRUCK_ID,
} from "@/lib/publishService";
import { isSupabaseConfigured, getSupabaseConfigHint } from "@/lib/supabase";
import { formatPublishedShort, formatPublishedTime, formatWeekOf } from "@/lib/format-local";
import { useHydrated } from "@/hooks/use-hydrated";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "TruckDash — Food Truck Dashboard & Flyer Studio" }],
  }),
  component: Dashboard,
});

// Types, defaults, and persistence are imported from @/lib/truck-state
// This keeps schedule in sync between dashboard and the dedicated /this-week page.

const SHARE_FORMATS: {
  id: ShareFormat;
  label: string;
  aspect: string;
  rows: string;
  menuLimit: number;
  bodyClass: string;
  titleClass: string;
  locationClass: string;
  menuItemClass: string;
  footerClass: string;
  orderClass: string;
  qrSize: string;
  qrNameClass: string;
}[] = [
  {
    id: "portrait",
    label: "Post 4:5",
    aspect: "aspect-[4/5]",
    rows: "34% minmax(0, 1fr) 136px",
    menuLimit: 4,
    bodyClass: "px-5 pt-3 pb-1 gap-1.5",
    titleClass: "text-[1.05rem]",
    locationClass: "text-sm",
    menuItemClass: "py-0.5 text-[10px]",
    footerClass: "px-5 pt-1 pb-4 gap-1.5",
    orderClass: "py-2 px-4 text-[10px]",
    qrSize: "size-[4.5rem]",
    qrNameClass: "text-[10px]",
  },
  {
    id: "story",
    label: "Story 9:16",
    aspect: "aspect-[9/16]",
    rows: "39% minmax(0, 1fr) 158px",
    menuLimit: 5,
    bodyClass: "px-5 pt-4 pb-1 gap-2",
    titleClass: "text-2xl",
    locationClass: "text-base",
    menuItemClass: "py-1 text-[11px]",
    footerClass: "px-5 pt-1 pb-5 gap-2",
    orderClass: "py-2.5 px-4 text-[11px]",
    qrSize: "size-[5.25rem]",
    qrNameClass: "text-[11px]",
  },
  {
    id: "square",
    label: "Square 1:1",
    aspect: "aspect-square",
    rows: "27% minmax(0, 1fr) 118px",
    menuLimit: 3,
    bodyClass: "px-4 pt-2 pb-0 gap-1",
    titleClass: "text-base",
    locationClass: "text-xs",
    menuItemClass: "py-0.5 text-[9px]",
    footerClass: "px-4 pt-0.5 pb-3 gap-1.5",
    orderClass: "py-1.5 px-3 text-[9px]",
    qrSize: "size-16",
    qrNameClass: "text-[10px]",
  },
];

// Inlined SVG textures so exports work offline.
const NOISE_SVG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.15  0 0 0 0.35 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.35'/></svg>\")";
const GRID_SVG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><path d='M24 0H0V24' fill='none' stroke='%231b4332' stroke-opacity='0.08' stroke-width='1'/></svg>\")";
const LINEN_SVG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='6' height='6'><path d='M0 3h6M3 0v6' stroke='%231b4332' stroke-opacity='0.09' stroke-width='0.5'/></svg>\")";

type BackgroundPreset = {
  id: BackgroundId;
  label: string;
  swatch: string;
  css: React.CSSProperties;
  darkText?: boolean;
};

const BACKGROUNDS: Record<BackgroundId, BackgroundPreset> = {
  paper: {
    id: "paper",
    label: "Paper",
    swatch: "#fffdf9",
    css: { backgroundColor: "#fffdf9" },
  },
  "cream-grid": {
    id: "cream-grid",
    label: "Cream Grid",
    swatch: "#f6ecd8",
    css: { backgroundColor: "#f6ecd8", backgroundImage: GRID_SVG },
  },
  kraft: {
    id: "kraft",
    label: "Kraft",
    swatch: "#d9b98a",
    css: {
      backgroundColor: "#d9b98a",
      backgroundImage: NOISE_SVG,
      backgroundBlendMode: "multiply",
    },
  },
  "sunset-gradient": {
    id: "sunset-gradient",
    label: "Sunset",
    swatch: "#f8a44c",
    css: {
      background: "linear-gradient(160deg, #ffd166 0%, #f8a44c 45%, #e85d04 100%)",
    },
  },
  "sage-linen": {
    id: "sage-linen",
    label: "Sage Linen",
    swatch: "#c9d6b9",
    css: { backgroundColor: "#e6ecdc", backgroundImage: LINEN_SVG },
  },
  "charcoal-grain": {
    id: "charcoal-grain",
    label: "Charcoal",
    swatch: "#2a231f",
    css: {
      backgroundColor: "#2a231f",
      backgroundImage: NOISE_SVG,
      backgroundBlendMode: "screen",
    },
    darkText: true,
  },
};

function validateUrl(u: string): { ok: boolean; reason?: string } {
  const trimmed = u.trim();
  if (!trimmed) return { ok: false, reason: "Empty" };
  if (!/^https?:\/\//i.test(trimmed)) return { ok: false, reason: "Missing https://" };
  try {
    new URL(trimmed);
    return { ok: true };
  } catch {
    return { ok: false, reason: "Not a valid URL" };
  }
}

type TemplateTheme = {
  id: TemplateId;
  label: string;
  frame: string; // outer frame bg
  paper: string; // inner card bg
  ink: string; // primary text
  inkSoft: string; // muted text
  accent: string; // accent color
  accentText: string; // text on accent
  divider: string;
  serif: string; // headline font stack
  hero: "photo" | "gradient" | "solid";
  swatch: string[]; // 3 colors for the preview chip
};

const TEMPLATES: Record<TemplateId, TemplateTheme> = {
  lakecumberland: {
    id: "lakecumberland",
    label: "Lake Cumberland",
    frame: "#1a3d2e",
    paper: "#f5efe1",
    ink: "#1a3d2e",
    inkSoft: "rgba(26,61,46,0.65)",
    accent: "#b8722c",
    accentText: "#fffdf6",
    divider: "rgba(26,61,46,0.15)",
    serif: '"Fraunces", Georgia, serif',
    hero: "photo",
    swatch: ["#1a3d2e", "#b8722c", "#f5efe1"],
  },
  festival: {
    id: "festival",
    label: "Festival Ready",
    frame: "#12283f",
    paper: "#fffdf6",
    ink: "#12283f",
    inkSoft: "rgba(18,40,63,0.65)",
    accent: "#d4a437",
    accentText: "#12283f",
    divider: "rgba(18,40,63,0.15)",
    serif: '"Fraunces", Georgia, serif',
    hero: "photo",
    swatch: ["#12283f", "#d4a437", "#fffdf6"],
  },
  bourbonbarrel: {
    id: "bourbonbarrel",
    label: "Bourbon Barrel",
    frame: "#4a2c1a",
    paper: "#f0dfb8",
    ink: "#3a1d0e",
    inkSoft: "rgba(58,29,14,0.7)",
    accent: "#b8722c",
    accentText: "#fffdf6",
    divider: "rgba(58,29,14,0.2)",
    serif: '"Fraunces", Georgia, serif',
    hero: "photo",
    swatch: ["#4a2c1a", "#b8722c", "#f0dfb8"],
  },
  bright: {
    id: "bright",
    label: "Bright & Fresh",
    frame: "#e85d04",
    paper: "#fffdf9",
    ink: "#1b4332",
    inkSoft: "rgba(27,67,50,0.65)",
    accent: "#e85d04",
    accentText: "#ffffff",
    divider: "rgba(27,67,50,0.12)",
    serif: '"Fraunces", Georgia, serif',
    hero: "photo",
    swatch: ["#e85d04", "#fffdf9", "#1b4332"],
  },
  bbq: {
    id: "bbq",
    label: "Classic BBQ",
    frame: "#3a1a10",
    paper: "#f4e3c8",
    ink: "#3a1a10",
    inkSoft: "rgba(58,26,16,0.7)",
    accent: "#b13d1f",
    accentText: "#fbf1de",
    divider: "rgba(58,26,16,0.2)",
    serif: '"Fraunces", Georgia, serif',
    hero: "photo",
    swatch: ["#b13d1f", "#f4e3c8", "#3a1a10"],
  },
  moody: {
    id: "moody",
    label: "Dark & Moody",
    frame: "#ffb703",
    paper: "#141210",
    ink: "#f6efe1",
    inkSoft: "rgba(246,239,225,0.65)",
    accent: "#ffb703",
    accentText: "#141210",
    divider: "rgba(246,239,225,0.15)",
    serif: '"Fraunces", Georgia, serif',
    hero: "photo",
    swatch: ["#141210", "#ffb703", "#f6efe1"],
  },
  minimal: {
    id: "minimal",
    label: "Minimal",
    frame: "#1b4332",
    paper: "#ffffff",
    ink: "#111111",
    inkSoft: "rgba(17,17,17,0.55)",
    accent: "#111111",
    accentText: "#ffffff",
    divider: "rgba(17,17,17,0.1)",
    serif: '"Fraunces", Georgia, serif',
    hero: "solid",
    swatch: ["#ffffff", "#111111", "#1b4332"],
  },
  boldbbq: {
    id: "boldbbq",
    label: "Bold BBQ",
    frame: "#1a0a06",
    paper: "#ffd93d",
    ink: "#1a0a06",
    inkSoft: "rgba(26,10,6,0.7)",
    accent: "#c9280f",
    accentText: "#fff8d1",
    divider: "rgba(26,10,6,0.25)",
    serif: '"Fraunces", Georgia, serif',
    hero: "photo",
    swatch: ["#c9280f", "#ffd93d", "#1a0a06"],
  },
  rustic: {
    id: "rustic",
    label: "Rustic Wood",
    frame: "#4a2c1a",
    paper: "#eadcc0",
    ink: "#3a1d0e",
    inkSoft: "rgba(58,29,14,0.65)",
    accent: "#6b8e23",
    accentText: "#fdfaf2",
    divider: "rgba(58,29,14,0.2)",
    serif: '"Fraunces", Georgia, serif',
    hero: "photo",
    swatch: ["#4a2c1a", "#6b8e23", "#eadcc0"],
  },
  clean: {
    id: "clean",
    label: "Clean Minimal",
    frame: "#f5f5f0",
    paper: "#ffffff",
    ink: "#1a1a1a",
    inkSoft: "rgba(26,26,26,0.5)",
    accent: "#ff6b35",
    accentText: "#ffffff",
    divider: "rgba(26,26,26,0.08)",
    serif: '"Fraunces", Georgia, serif',
    hero: "gradient",
    swatch: ["#ffffff", "#ff6b35", "#1a1a1a"],
  },
};

// useTruckState is now imported from @/lib/truck-state (single source of truth for schedule persistence)

function Dashboard() {
  const hydrated = useHydrated();
  const [state, setState] = useTruckState();
  const [tab, setTab] = useState<"home" | "menu" | "flyer" | "catering">("home");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showOnboard, setShowOnboard] = useState(false);
  const flyerRef = useRef<HTMLDivElement | null>(null);
  const menuHighlights = useMemo(() => state.menu.slice(0, 3), [state.menu]);

  // Publish to Website state (shared data system)
  const [lastPublished, setLastPublished] = useState<string | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishToast, setPublishToast] = useState<string | null>(null);
  // Client-only flags — must stay false on SSR + first paint to avoid hydration mismatch
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [cloudPending, setCloudPending] = useState(false);

  // Load last published timestamp on mount; flush offline cloud queue if any
  useEffect(() => {
    if (!hydrated) return;
    setCloudEnabled(canUseSupabaseSync());
    setCloudPending(hasPendingCloudSync());
    getPublishedData().then((p) => {
      if (p.lastPublished) setLastPublished(p.lastPublished);
    });
    void flushPendingCloudSync().then(() => {
      setCloudPending(hasPendingCloudSync());
    });
  }, [hydrated]);

  const handlePublishToWebsite = async () => {
    setPublishBusy(true);
    try {
      // Explicit truck path: menu-data/cluckin-chaos/menu.json (or Settings truck id)
      const truckId = getConfiguredTruckId().trim() || DEFAULT_TRUCK_ID || "cluckin-chaos";
      const payload = buildPublishPayloadFromState(state);
      console.info("[Publish] button clicked → Supabase Storage", {
        truckId,
        targetPath: `menu-data/${truckId}/menu.json`,
        menuItems: payload.menu.length,
        scheduleDays: payload.schedule.length,
      });

      const result = await publishData(payload, { truckId });
      setLastPublished(result.published.lastPublished);
      setCloudEnabled(canUseSupabaseSync());
      setCloudPending(hasPendingCloudSync() || result.source === "local+queued");

      const time = formatPublishedTime(result.published.lastPublished);
      if (result.source === "storage") {
        setPublishToast(
          result.message ||
            `Published at ${time}! menu-data/${truckId}/menu.json is live on Supabase Storage.`,
        );
        setCloudPending(false);
      } else if (result.source === "local+queued") {
        setPublishToast(result.message || `Saved at ${time} — Supabase Storage upload pending`);
      } else {
        setPublishToast(
          result.message ||
            `Saved locally at ${time}. Add VITE_SUPABASE_URL + key to upload to menu-data.`,
        );
      }
      setTimeout(() => setPublishToast(null), 5000);
    } catch (e) {
      console.error("[Publish] failed", e);
      setPublishToast(
        e instanceof Error ? `Publish failed: ${e.message}` : "Publish failed — please try again",
      );
      setTimeout(() => setPublishToast(null), 5000);
    } finally {
      setPublishBusy(false);
    }
  };

  // Force-reload on version bump so users always get latest assets.
  useEffect(() => {
    try {
      const prev = localStorage.getItem(VERSION_KEY);
      if (prev && prev !== APP_VERSION) {
        localStorage.setItem(VERSION_KEY, APP_VERSION);
        window.location.reload();
        return;
      }
      if (!prev) localStorage.setItem(VERSION_KEY, APP_VERSION);
    } catch {
      /* non-fatal: version or onboarding flag storage */
    }
    try {
      if (!localStorage.getItem(ONBOARD_KEY)) setShowOnboard(true);
    } catch {
      /* non-fatal: version or onboarding flag storage */
    }
  }, []);

  const dismissOnboard = () => {
    try {
      localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      /* non-fatal: version or onboarding flag storage */
    }
    setShowOnboard(false);
  };

  return (
    <div className="min-h-screen bg-brand-sand text-brand-green pb-28">
      <div className="print:hidden">
        <Header state={state} setState={setState} onOpenSettings={() => setSettingsOpen(true)} />
      </div>

      <main className="mx-auto max-w-md px-4 pt-4 space-y-6 print:hidden">
        {tab === "home" && (
          <>
            <StatusCard state={state} setState={setState} />

            {/* PROMINENT: Publish to My Website — core new feature */}
            <PublishToWebsiteCard
              lastPublished={lastPublished}
              busy={publishBusy}
              onPublish={handlePublishToWebsite}
              cloudEnabled={cloudEnabled}
              cloudPending={cloudPending}
            />

            <QuickActions
              onOpenMenu={() => setTab("menu")}
              onOpenFlyer={() => setTab("flyer")}
              onOpenCatering={() => setTab("catering")}
            />
            <WeekPreviewCard schedule={state.schedule} />
            <MenuHighlightsCard items={menuHighlights} onEdit={() => setTab("menu")} />
            <FlyerSection state={state} setState={setState} flyerRef={flyerRef} />
          </>
        )}

        {tab === "menu" && (
          <MenuManager state={state} setState={setState} onDone={() => setTab("home")} />
        )}

        {tab === "flyer" && (
          <FlyerSection state={state} setState={setState} flyerRef={flyerRef} standalone />
        )}

        {tab === "catering" && (
          <CateringOwnerView state={state} setState={setState} onDone={() => setTab("home")} />
        )}

        <footer className="pt-6 pb-2 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-green/40">
            TruckDash · v{APP_VERSION}
          </p>
        </footer>

        {/* Publish toast (warm, non-intrusive) */}
        {publishToast && (
          <div
            role="status"
            className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-brand-green text-white text-sm font-medium px-5 py-2 rounded-full shadow-xl shadow-brand-green/30 z-50 max-w-[88vw] text-center"
          >
            {publishToast}
          </div>
        )}
      </main>

      <PrintableSchedule state={state} />

      <BottomNav tab={tab} setTab={setTab} />

      {settingsOpen && (
        <SettingsSheet state={state} setState={setState} onClose={() => setSettingsOpen(false)} />
      )}

      {showOnboard && (
        <OnboardingModal
          onDone={() => {
            dismissOnboard();
            setTab("flyer");
          }}
          onSkip={dismissOnboard}
        />
      )}
    </div>
  );
}

function OnboardingModal({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button
        onClick={onSkip}
        aria-label="Close"
        className="absolute inset-0 bg-brand-green/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md bg-brand-sand rounded-t-[2rem] sm:rounded-3xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-brand-orange" />
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-orange">
            Howdy, neighbor
          </span>
        </div>
        <h2 className="font-display text-2xl leading-tight">
          Daily flyers that work as hard as you do.
        </h2>
        <p className="text-sm text-brand-green/70 leading-relaxed">
          Built by a Monticello neighbor for the trucks running Lake Cumberland — ramps, festivals,
          and Food Truck Friday. Update your spot, spin up a flyer, and get back to cooking.
        </p>
        <ul className="space-y-2.5 text-sm">
          {[
            ["📍", "One-tap “Today's Location” with GPS"],
            ["🎨", "Kentucky-flavored flyer templates"],
            ["📐", "Post, Story & Square — sized for Facebook & Instagram"],
            ["📷", "Snap your own food photo, right from your phone"],
            ["🔗", "Real QR code for order-ahead & tips"],
          ].map(([icon, text]) => (
            <li key={text} className="flex gap-3 items-start">
              <span className="text-lg leading-none pt-0.5">{icon}</span>
              <span className="text-brand-green/80">{text}</span>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onSkip}
            className="py-3.5 rounded-2xl text-sm font-bold text-brand-green/70 bg-white border border-brand-green/10"
          >
            Look around first
          </button>
          <button
            onClick={onDone}
            className="py-3.5 rounded-2xl text-sm font-bold text-white bg-brand-orange shadow-lg shadow-brand-orange/25"
          >
            Make my first flyer
          </button>
        </div>
      </div>
    </div>
  );
}

function Header({
  state,
  setState,
  onOpenSettings,
}: {
  state: TruckState;
  setState: (s: TruckState) => void;
  onOpenSettings: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 bg-brand-sand/85 backdrop-blur-md border-b border-brand-green/5 px-4 py-3 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
      <div className="min-w-0 pl-1">
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-brand-orange" />
          <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-brand-orange">
            TruckDash
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <h1 className="font-display text-xl font-bold tracking-tight truncate leading-tight">
            {state.name}
          </h1>
          <Link
            to="/this-week"
            className="text-[9px] font-bold uppercase tracking-[0.18em] text-brand-orange hover:underline shrink-0"
          >
            This Week →
          </Link>
        </div>
        <p className="text-[9px] font-semibold text-brand-green/60 uppercase tracking-[0.2em]">
          {state.live ? "Active Session" : "Off the clock"}
        </p>
      </div>

      <button
        onClick={() => setState({ ...state, live: !state.live })}
        aria-pressed={state.live}
        className={`shrink-0 flex items-center gap-2 pl-3 pr-3.5 py-2 rounded-full border transition-colors ${
          state.live
            ? "bg-brand-green text-white border-brand-green"
            : "bg-white text-brand-green/60 border-brand-green/10"
        }`}
      >
        <span
          className={`size-2 rounded-full ${state.live ? "bg-brand-gold animate-pulse" : "bg-brand-green/30"}`}
        />
        <span className="text-[11px] font-bold uppercase tracking-wider">
          {state.live ? "Live" : "Offline"}
        </span>
      </button>
      <button
        onClick={onOpenSettings}
        aria-label="Settings"
        className="shrink-0 size-10 grid place-items-center rounded-full bg-white border border-brand-green/10 text-brand-green"
      >
        <GearIcon className="size-5" />
      </button>
    </header>
  );
}

function StatusCard({ state, setState }: { state: TruckState; setState: (s: TruckState) => void }) {
  const [editing, setEditing] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);

  const useCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      setGpsMsg("GPS not available on this device");
      return;
    }
    setGpsBusy(true);
    setGpsMsg(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16&addressdetails=1`,
            { headers: { Accept: "application/json" } },
          );
          const data = await res.json();
          const a = data?.address ?? {};
          const parts = [
            a.road || a.pedestrian || a.neighbourhood || a.hamlet,
            a.city || a.town || a.village || a.county,
          ].filter(Boolean);
          const label =
            parts.join(", ") ||
            data?.display_name ||
            `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          setState({ ...state, location: label });
          setGpsMsg("Location updated");
        } catch {
          setState({ ...state, location: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` });
          setGpsMsg("Set GPS coordinates");
        } finally {
          setGpsBusy(false);
          setTimeout(() => setGpsMsg(null), 2400);
        }
      },
      (err) => {
        setGpsBusy(false);
        setGpsMsg(err.code === 1 ? "Location permission blocked" : "Couldn't get location");
        setTimeout(() => setGpsMsg(null), 2400);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  return (
    <section className="bg-brand-green text-white rounded-3xl p-6 shadow-xl shadow-brand-green/15">
      <div className="flex justify-between items-start mb-4 gap-3">
        <div className="min-w-0 space-y-1 flex-1">
          <p className="text-brand-gold text-[10px] font-bold uppercase tracking-[0.2em]">
            Today's Location
          </p>
          {editing ? (
            <input
              autoFocus
              value={state.location}
              onChange={(e) => setState({ ...state, location: e.target.value })}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
              className="font-display text-xl bg-transparent border-b border-white/30 focus:border-brand-gold outline-none w-full py-0.5"
            />
          ) : (
            <h2 className="font-display text-xl truncate">{state.location}</h2>
          )}
          <p className="text-white/70 text-sm">
            {state.hoursStart} — {state.hoursEnd}
          </p>
        </div>
        <button
          onClick={() => setEditing((e) => !e)}
          aria-label="Edit location"
          className="shrink-0 bg-white/10 hover:bg-white/15 transition p-2.5 rounded-xl border border-white/10"
        >
          <PencilIcon className="size-4" />
        </button>
      </div>

      <button
        onClick={useCurrentLocation}
        disabled={gpsBusy}
        className="w-full mb-4 flex items-center justify-center gap-2 bg-brand-gold text-brand-green font-bold uppercase tracking-wider text-xs py-3 rounded-2xl shadow-lg shadow-brand-gold/20 active:scale-[0.98] transition disabled:opacity-70"
      >
        <PinIcon className="size-4" />
        {gpsBusy ? "Getting GPS…" : (gpsMsg ?? "Use my current location")}
      </button>

      <div className="grid grid-cols-2 gap-3">
        <label className="bg-white/5 rounded-2xl p-4 border border-white/10 cursor-text block">
          <p className="text-[10px] uppercase opacity-60 mb-1 font-semibold tracking-wider">
            Special
          </p>
          <input
            value={state.special}
            onChange={(e) => setState({ ...state, special: e.target.value })}
            className="text-sm font-medium bg-transparent outline-none w-full"
          />
        </label>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <p className="text-[10px] uppercase opacity-60 mb-1 font-semibold tracking-wider">Menu</p>
          <p className="text-sm font-medium">{state.menu.length} items</p>
        </div>
      </div>
    </section>
  );
}

function QuickActions({
  onOpenMenu,
  onOpenFlyer,
  onOpenCatering,
}: {
  onOpenMenu: () => void;
  onOpenFlyer: () => void;
  onOpenCatering: () => void;
}) {
  return (
    <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Link
        to="/this-week"
        className="flex flex-col items-center justify-center gap-2 bg-white p-4 rounded-3xl border border-brand-green/5 shadow-sm active:scale-[0.98] transition"
      >
        <div className="size-11 rounded-2xl bg-brand-green/10 flex items-center justify-center text-brand-green">
          <CalendarIcon className="size-5" />
        </div>
        <span className="text-xs font-semibold text-brand-green">This Week</span>
      </Link>
      <button
        onClick={onOpenCatering}
        className="flex flex-col items-center justify-center gap-2 bg-white p-4 rounded-3xl border border-brand-green/5 shadow-sm active:scale-[0.98] transition"
      >
        <div className="size-11 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange">
          <CateringIcon className="size-5" />
        </div>
        <span className="text-xs font-semibold text-brand-green">Catering</span>
      </button>
      <button
        onClick={onOpenMenu}
        className="flex flex-col items-center justify-center gap-2 bg-white p-4 rounded-3xl border border-brand-green/5 shadow-sm active:scale-[0.98] transition"
      >
        <div className="size-11 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange">
          <ForkKnifeIcon className="size-5" />
        </div>
        <span className="text-xs font-semibold text-brand-green">Menu</span>
      </button>
      <button
        onClick={onOpenFlyer}
        className="flex flex-col items-center justify-center gap-2 bg-white p-4 rounded-3xl border border-brand-green/5 shadow-sm active:scale-[0.98] transition"
      >
        <div className="size-11 rounded-2xl bg-brand-gold/15 flex items-center justify-center text-brand-green">
          <SparklesIcon className="size-5" />
        </div>
        <span className="text-xs font-semibold text-brand-green">Flyer</span>
      </button>
      <Link
        to="/menu"
        target="_blank"
        className="flex flex-col items-center justify-center gap-2 bg-white p-4 rounded-3xl border border-brand-green/5 shadow-sm active:scale-[0.98] transition"
      >
        <div className="size-11 rounded-2xl bg-brand-green/10 flex items-center justify-center text-brand-green">
          <GlobeIcon className="size-5" />
        </div>
        <span className="text-xs font-semibold text-brand-green">My Website</span>
      </Link>
    </section>
  );
}

/* ---------------- Publish to My Website (core new feature) ---------------- */

function PublishToWebsiteCard({
  lastPublished,
  busy,
  onPublish,
  cloudEnabled,
  cloudPending,
}: {
  lastPublished: string | null;
  busy: boolean;
  onPublish: () => void;
  cloudEnabled: boolean;
  cloudPending: boolean;
}) {
  // lastPublished is always null on SSR/first paint (loaded in useEffect) — safe to format
  const formatted = lastPublished ? formatPublishedShort(lastPublished) : null;

  return (
    <section className="bg-white rounded-3xl border border-brand-green/10 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-brand-orange">🌾</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-green/60">
              SHARED WITH YOUR WEBSITE
            </span>
          </div>
          <h3 className="font-display text-xl mt-1">Publish Updates to My Website</h3>
          <p className="text-sm text-brand-green/70 mt-1 pr-2">
            Uploads full menu + schedule via the Supabase client to{" "}
            <code className="text-[11px] bg-brand-sand px-1 rounded">
              menu-data/cluckin-chaos/menu.json
            </code>{" "}
            (env: <code className="text-[11px] bg-brand-sand px-1 rounded">VITE_SUPABASE_URL</code>
            ). Cluckin Chaos reads that public URL with cache busting.
          </p>
          {formatted && (
            <p className="text-[11px] text-brand-green/50 mt-2" suppressHydrationWarning>
              Last published: {formatted}
              {cloudEnabled && (
                <span className="ml-1 text-brand-orange/80">· Supabase sync on</span>
              )}
              {cloudPending && (
                <span className="ml-1 text-brand-orange font-semibold">· Cloud pending</span>
              )}
            </p>
          )}
        </div>
      </div>

      <button
        onClick={onPublish}
        disabled={busy}
        className="mt-4 w-full flex items-center justify-center gap-2 bg-brand-orange hover:bg-[#a36624] active:scale-[0.985] transition text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-brand-orange/25 disabled:opacity-70"
      >
        {busy ? "Publishing…" : "Publish Updates to My Website"}
      </button>

      <div className="mt-3 flex items-center justify-center gap-4 text-xs flex-wrap">
        <Link
          to="/website"
          target="_blank"
          className="text-brand-orange font-bold underline underline-offset-2"
        >
          Preview website ↗
        </Link>
        <span className="text-brand-green/30">·</span>
        <Link to="/menu" target="_blank" className="text-brand-green/70 hover:text-brand-green">
          Live menu
        </Link>
        <span className="text-brand-green/30">·</span>
        <Link to="/schedule" target="_blank" className="text-brand-green/70 hover:text-brand-green">
          Schedule
        </Link>
        <span className="text-brand-green/30">·</span>
        <button
          onClick={async () => {
            try {
              await exportPublishedJSON();
            } catch {
              alert("Publish first, then you can export the JSON for other websites.");
            }
          }}
          className="text-brand-green/70 hover:text-brand-green"
        >
          Export JSON
        </button>
      </div>

      <p className="text-center text-[10px] text-brand-green/50 mt-2">
        One tap keeps customers up to date. Works offline — syncs when you reconnect.
      </p>
    </section>
  );
}

function MenuHighlightsCard({ items, onEdit }: { items: MenuItem[]; onEdit: () => void }) {
  return (
    <section className="bg-white rounded-3xl p-5 border border-brand-green/5 shadow-sm">
      <div className="flex justify-between items-baseline mb-3">
        <h3 className="font-display text-lg">Menu Highlights</h3>
        <button
          onClick={onEdit}
          className="text-[11px] text-brand-orange font-bold uppercase tracking-wider"
        >
          Manage
        </button>
      </div>
      <ul className="divide-y divide-brand-green/5">
        {items.map((item) => (
          <li key={item.id} className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
            <span className="text-sm font-medium truncate pr-3">{item.name}</span>
            <span className="text-sm font-semibold text-brand-orange shrink-0">${item.price}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MenuManager({
  state,
  setState,
  onDone,
}: {
  state: TruckState;
  setState: (s: TruckState) => void;
  onDone: () => void;
}) {
  const addItem = () => {
    setState({
      ...state,
      menu: [...state.menu, { id: crypto.randomUUID(), name: "New item", price: "0" }],
    });
  };
  const updateItem = (id: string, patch: Partial<MenuItem>) => {
    setState({
      ...state,
      menu: state.menu.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
  };
  const removeItem = (id: string) => {
    setState({ ...state, menu: state.menu.filter((m) => m.id !== id) });
  };

  return (
    <section className="space-y-4">
      <div className="flex justify-between items-baseline">
        <h2 className="font-display text-2xl">Menu</h2>
        <button
          onClick={onDone}
          className="text-xs font-bold uppercase tracking-wider text-brand-orange"
        >
          Done
        </button>
      </div>

      {/* Same path as home Publish: Supabase Storage menu-data/{truckId}/menu.json */}
      <button
        onClick={async () => {
          try {
            const truckId = getConfiguredTruckId().trim() || DEFAULT_TRUCK_ID || "cluckin-chaos";
            const payload = buildPublishPayloadFromState(state);
            const result = await publishData(payload, { truckId });
            const t = formatPublishedTime(result.published.lastPublished);
            if (result.source === "storage") {
              alert(
                `Published to Supabase Storage!\nmenu-data/${truckId}/menu.json\nLive as of ${t}`,
              );
            } else {
              alert(result.message || `Saved at ${t} — Supabase upload did not complete.`);
            }
          } catch (err) {
            alert(err instanceof Error ? err.message : "Could not publish. Try again.");
          }
        }}
        className="w-full py-3 rounded-2xl bg-brand-orange text-white font-bold text-sm active:scale-[0.985] transition"
      >
        Publish Menu Updates to My Website
      </button>

      <div className="bg-white rounded-3xl border border-brand-green/5 shadow-sm divide-y divide-brand-green/5">
        {state.menu.map((item) => (
          <div key={item.id} className="p-3 space-y-2">
            <div className="grid grid-cols-[minmax(0,1fr)_5rem_auto] items-center gap-2">
              <input
                value={item.name}
                onChange={(e) => updateItem(item.id, { name: e.target.value })}
                placeholder="Item name"
                className="min-w-0 bg-transparent text-sm font-medium outline-none px-2 py-2 rounded-lg focus:bg-brand-sand"
              />
              <div className="flex items-center gap-1 rounded-lg focus-within:bg-brand-sand px-2">
                <span className="text-brand-green/40 text-sm">$</span>
                <input
                  value={item.price}
                  onChange={(e) =>
                    updateItem(item.id, { price: e.target.value.replace(/[^\d.]/g, "") })
                  }
                  inputMode="decimal"
                  className="w-full bg-transparent text-sm font-semibold outline-none py-2 text-right"
                />
              </div>
              <button
                onClick={() => removeItem(item.id)}
                aria-label="Remove item"
                className="size-8 shrink-0 rounded-full text-brand-green/40 hover:text-destructive hover:bg-destructive/5 grid place-items-center"
              >
                <XIcon className="size-4" />
              </button>
            </div>
            <input
              value={item.description || ""}
              onChange={(e) => updateItem(item.id, { description: e.target.value })}
              placeholder="Short description (optional)"
              className="w-full text-xs text-brand-green/80 outline-none px-2 py-1.5 rounded-lg focus:bg-brand-sand"
            />
            <div className="flex items-center gap-3 px-1">
              {item.image && (
                <img
                  src={item.image}
                  alt=""
                  className="size-10 rounded-lg object-cover border border-brand-green/10"
                />
              )}
              <label className="text-xs font-semibold text-brand-orange cursor-pointer">
                {item.image ? "Change photo" : "Add photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      if (typeof reader.result === "string") {
                        updateItem(item.id, { image: reader.result });
                      }
                    };
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }}
                />
              </label>
              {item.image && (
                <button
                  type="button"
                  onClick={() => updateItem(item.id, { image: undefined })}
                  className="text-[10px] text-brand-green/50 hover:text-destructive"
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addItem}
        className="w-full flex items-center justify-center gap-2 bg-white border border-dashed border-brand-green/20 text-brand-green font-semibold py-4 rounded-2xl active:scale-[0.99] transition"
      >
        <PlusIcon className="size-4" /> Add menu item
      </button>

      <div className="rounded-2xl bg-brand-green/5 border border-brand-green/10 p-4 text-xs text-brand-green/70 leading-relaxed">
        <span className="font-semibold text-brand-green">Coming soon:</span> pull your menu straight
        from Square and add an order-ahead link to every flyer.
      </div>
    </section>
  );
}

/* ------------------------------- Flyer ------------------------------- */

function FlyerSection({
  state,
  setState,
  flyerRef,
  standalone = false,
}: {
  state: TruckState;
  setState: (s: TruckState) => void;
  flyerRef: React.MutableRefObject<HTMLDivElement | null>;
  standalone?: boolean;
}) {
  const [busy, setBusy] = useState<null | "png" | "share" | "fb">(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const captureBlob = async () => {
    if (!flyerRef.current) return null;
    // pixelRatio 3 → ~1170x1462, plenty for social.
    return await toBlob(flyerRef.current, {
      pixelRatio: 3,
      cacheBust: true,
      backgroundColor: TEMPLATES[state.template].frame,
    });
  };

  const downloadPng = async () => {
    if (!flyerRef.current) return;
    setBusy("png");
    try {
      const dataUrl = await toPng(flyerRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: TEMPLATES[state.template].frame,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${slug(state.name)}-flyer.png`;
      a.click();
      setToast("Saved to your device");
    } catch (e) {
      console.error(e);
      setToast("Couldn't export flyer");
    } finally {
      setBusy(null);
    }
  };

  const shareNative = async () => {
    setBusy("share");
    try {
      const blob = await captureBlob();
      const caption = buildCaption(state);
      if (blob && navigator.canShare) {
        const file = new File([blob], `${slug(state.name)}-flyer.png`, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: state.name, text: caption });
          return;
        }
      }
      if (navigator.share) {
        await navigator.share({ title: state.name, text: caption });
        return;
      }
      await navigator.clipboard.writeText(caption);
      setToast("Share not supported — caption copied");
    } catch (e: unknown) {
      if ((e as { name?: string })?.name !== "AbortError") {
        console.error(e);
      }
    } finally {
      setBusy(null);
    }
  };

  const shareFacebook = async () => {
    setBusy("fb");
    try {
      const blob = await captureBlob();
      if (blob) triggerDownload(blob, `${slug(state.name)}-flyer.png`);
      await copyText(buildCaption(state));
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(state.orderUrl || window.location.href)}`,
        "_blank",
        "noopener,noreferrer",
      );
      setToast("Flyer saved · caption copied — attach it in Facebook");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex justify-between items-baseline">
        <h3 className="font-display text-lg">{standalone ? "Flyer Studio" : "Daily Flyer"}</h3>
        <span className="text-[11px] text-brand-orange font-bold uppercase tracking-wider">
          Live preview
        </span>
      </div>

      <FormatPicker
        value={state.shareFormat}
        onChange={(f) => setState({ ...state, shareFormat: f })}
      />

      <TemplatePicker
        value={state.template}
        onChange={(t) => setState({ ...state, template: t })}
      />

      <BackgroundPicker
        value={state.background}
        onChange={(b) => setState({ ...state, background: b })}
      />

      {standalone && (
        <>
          <QrPreviewCard state={state} setState={setState} />
          <FlyerCustomizer state={state} setState={setState} />
        </>
      )}

      <Flyer state={state} ref={flyerRef} />

      <button
        onClick={shareNative}
        disabled={busy !== null}
        className="w-full bg-brand-orange text-white font-bold py-4 rounded-2xl shadow-lg shadow-brand-orange/25 active:scale-[0.98] transition disabled:opacity-60"
      >
        {busy === "share"
          ? "Preparing flyer…"
          : `Share ${SHARE_FORMATS.find((f) => f.id === state.shareFormat)?.label ?? "Flyer"}`}
      </button>

      <div className="grid grid-cols-3 gap-2">
        <ShareChip
          label={busy === "png" ? "Rendering…" : "Download"}
          onClick={downloadPng}
          disabled={busy !== null}
        />
        <ShareChip
          label={busy === "fb" ? "…" : "Facebook"}
          onClick={shareFacebook}
          disabled={busy !== null}
        />
        <ShareChip
          label="Copy Caption"
          onClick={async () => {
            await copyText(buildCaption(state));
            setToast("Caption copied");
          }}
          disabled={busy !== null}
        />
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-brand-green text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-xl shadow-brand-green/30 z-50 max-w-[90vw] text-center"
        >
          {toast}
        </div>
      )}
    </section>
  );
}

function FlyerCustomizer({
  state,
  setState,
}: {
  state: TruckState;
  setState: (s: TruckState) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (result) setState({ ...state, heroPhoto: result });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <section className="bg-white rounded-3xl border border-brand-green/5 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-brand-green/60">
          Flyer content
        </h4>
      </div>

      {/* Photo */}
      <div className="flex items-center gap-3">
        <div className="size-14 rounded-xl overflow-hidden bg-brand-sand border border-brand-green/10 shrink-0">
          <img src={state.heroPhoto || flyerFood} alt="" className="size-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-brand-green">Food photo</p>
          <p className="text-[11px] text-brand-green/60 truncate">
            {state.heroPhoto ? "Your photo" : "Default photo"}
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => fileRef.current?.click()}
            className="text-[11px] font-bold uppercase tracking-wider text-brand-orange bg-brand-orange/10 px-3 py-2 rounded-lg"
          >
            {state.heroPhoto ? "Replace" : "Upload"}
          </button>
          {state.heroPhoto && (
            <button
              onClick={() => setState({ ...state, heroPhoto: undefined })}
              className="text-[11px] font-bold uppercase tracking-wider text-brand-green/60 bg-brand-green/5 px-3 py-2 rounded-lg"
            >
              Reset
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onPickPhoto}
        />
      </div>

      {/* Order-ahead URL */}
      <label className="block space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-green/60">
          Order Ahead URL
        </span>
        <input
          type="url"
          inputMode="url"
          value={state.orderUrl}
          onChange={(e) => setState({ ...state, orderUrl: e.target.value })}
          placeholder="https://order.square.site/..."
          className="w-full bg-brand-sand rounded-xl px-3 py-2.5 text-sm font-medium border border-brand-green/10 focus:outline-none focus:border-brand-orange"
        />
        <span className="block text-[11px] text-brand-green/50">
          Used on the flyer button and QR code.
        </span>
      </label>
    </section>
  );
}

function TemplatePicker({
  value,
  onChange,
}: {
  value: TemplateId;
  onChange: (t: TemplateId) => void;
}) {
  const ids: TemplateId[] = [
    "lakecumberland",
    "festival",
    "bourbonbarrel",
    "bright",
    "boldbbq",
    "rustic",
    "clean",
    "bbq",
    "moody",
    "minimal",
  ];
  return (
    <div className="-mx-4 px-4 overflow-x-auto no-scrollbar">
      <div className="flex gap-2.5 pb-1">
        {ids.map((id) => {
          const t = TEMPLATES[id];
          const active = value === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`shrink-0 flex items-center gap-2.5 pl-1.5 pr-3.5 py-1.5 rounded-full border transition ${
                active
                  ? "bg-brand-green text-white border-brand-green shadow-md shadow-brand-green/20"
                  : "bg-white text-brand-green/70 border-brand-green/10"
              }`}
            >
              <span className="flex -space-x-1">
                {t.swatch.map((c, i) => (
                  <span
                    key={i}
                    className="size-5 rounded-full ring-2 ring-white"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ShareChip({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="bg-white border border-brand-green/5 rounded-full py-3 text-xs font-semibold text-brand-green active:scale-[0.97] transition disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function FormatPicker({
  value,
  onChange,
}: {
  value: ShareFormat;
  onChange: (f: ShareFormat) => void;
}) {
  return (
    <div className="flex gap-2">
      {SHARE_FORMATS.map((f) => {
        const active = value === f.id;
        return (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            className={`flex-1 py-2 rounded-full border text-[11px] font-bold uppercase tracking-wider transition ${
              active
                ? "bg-brand-green text-white border-brand-green shadow-md shadow-brand-green/20"
                : "bg-white text-brand-green/70 border-brand-green/10"
            }`}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

function BackgroundPicker({
  value,
  onChange,
}: {
  value: BackgroundId;
  onChange: (b: BackgroundId) => void;
}) {
  return (
    <div className="-mx-4 px-4 overflow-x-auto no-scrollbar">
      <div className="flex gap-2 pb-1 items-center">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-green/50 shrink-0 pr-1">
          Background
        </span>
        {Object.values(BACKGROUNDS).map((b) => {
          const active = value === b.id;
          return (
            <button
              key={b.id}
              onClick={() => onChange(b.id)}
              aria-label={b.label}
              title={b.label}
              className={`shrink-0 size-9 rounded-full border-2 transition ${
                active ? "border-brand-orange scale-110" : "border-white"
              }`}
              style={{
                ...b.css,
                boxShadow: active
                  ? "0 0 0 2px rgba(232,93,4,0.15)"
                  : "0 0 0 1px rgba(27,67,50,0.08)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function QrPreviewCard({
  state,
  setState,
}: {
  state: TruckState;
  setState: (s: TruckState) => void;
}) {
  const effective = (state.qrUrl.trim() || state.orderUrl.trim() || "https://truckdash.app").trim();
  const validation = validateUrl(effective);
  const [mini, setMini] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    if (!validation.ok) {
      setMini("");
      return;
    }
    QRCode.toDataURL(effective, {
      margin: 0,
      scale: 4,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setMini(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [effective, validation.ok]);

  return (
    <section className="bg-white rounded-3xl border border-brand-green/5 shadow-sm p-4 flex gap-4 items-center">
      <div className="size-20 rounded-xl bg-white ring-1 ring-brand-green/10 p-1.5 grid place-items-center shrink-0">
        {mini ? (
          <img src={mini} alt="QR preview" className="size-full" />
        ) : (
          <span className="text-[9px] text-brand-green/40">QR</span>
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-green/60">
            QR encodes
          </span>
          {validation.ok ? (
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-green bg-brand-green/10 px-2 py-0.5 rounded-full">
              Valid
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-orange bg-brand-orange/10 px-2 py-0.5 rounded-full">
              {validation.reason}
            </span>
          )}
        </div>
        <input
          type="url"
          inputMode="url"
          value={state.qrUrl}
          onChange={(e) => setState({ ...state, qrUrl: e.target.value })}
          placeholder="Same as Order Ahead URL"
          className="w-full bg-brand-sand rounded-lg px-2.5 py-2 text-xs font-mono border border-brand-green/10 focus:outline-none focus:border-brand-orange"
        />
        <p className="text-[10px] text-brand-green/50 truncate">→ {effective}</p>
      </div>
    </section>
  );
}

const Flyer = ({
  state,
  ref,
}: {
  state: TruckState;
  ref: React.MutableRefObject<HTMLDivElement | null>;
}) => {
  const t = TEMPLATES[state.template];
  const bg = BACKGROUNDS[state.background];
  const format = SHARE_FORMATS.find((f) => f.id === state.shareFormat) ?? SHARE_FORMATS[0];
  const qrTarget = state.qrUrl.trim() || state.orderUrl.trim() || "https://truckdash.app";
  const paperInk = bg.darkText ? "#f6efe1" : t.ink;
  const paperInkSoft = bg.darkText ? "rgba(246,239,225,0.7)" : t.inkSoft;
  const paperDivider = bg.darkText ? "rgba(246,239,225,0.15)" : t.divider;
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(qrTarget, {
      margin: 0,
      scale: 8,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [qrTarget, t.ink]);

  const domain = useMemo(() => {
    try {
      return new URL(qrTarget).host.replace(/^www\./, "");
    } catch {
      return "";
    }
  }, [qrTarget]);

  return (
    <div
      ref={ref}
      id="truckdash-flyer"
      className={`relative overflow-hidden rounded-[2.25rem] p-1.5 shadow-2xl ${format.aspect}`}
      style={{ backgroundColor: t.frame, boxShadow: `0 20px 40px -20px ${t.frame}55` }}
    >
      <div
        className="rounded-[1.85rem] overflow-hidden size-full grid"
        style={{ ...bg.css, color: paperInk, gridTemplateRows: format.rows }}
      >
        {/* Hero */}
        <div className="relative w-full min-h-0 overflow-hidden">
          {t.hero === "photo" ? (
            <img
              src={state.heroPhoto || flyerFood}
              alt=""
              className="absolute inset-0 size-full object-cover"
              crossOrigin="anonymous"
              style={{ boxShadow: "inset 0 -20px 40px -20px rgba(0,0,0,0.35)" }}
            />
          ) : (
            <div
              className="absolute inset-0 grid place-items-center"
              style={{
                background: `radial-gradient(circle at 30% 20%, ${t.accent}22, transparent 60%)`,
              }}
            >
              <span
                className="text-[10rem] leading-none font-bold italic"
                style={{ fontFamily: t.serif, color: paperInk, opacity: 0.12 }}
              >
                {initials(state.name)}
              </span>
            </div>
          )}
          <div
            className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur"
            style={{
              backgroundColor: bg.darkText ? "rgba(20,18,16,0.75)" : `${t.paper}ee`,
              color: paperInk,
            }}
          >
            <span
              className="size-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: t.accent }}
            />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              {state.live ? "Live Today" : "Today's Menu"}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className={`min-h-0 overflow-hidden flex flex-col text-center ${format.bodyClass}`}>
          {/* Special */}
          <div className="space-y-1 shrink-0">
            <div
              className="inline-block px-3 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.2em]"
              style={{ backgroundColor: t.accent, color: t.accentText }}
            >
              Today's Special
            </div>
            <h4
              className={`leading-tight italic text-balance line-clamp-2 ${format.titleClass}`}
              style={{ fontFamily: t.serif, color: paperInk }}
            >
              {state.special}
            </h4>
          </div>

          {/* Location */}
          <div className="space-y-0 shrink-0">
            <p
              className="text-[9px] font-bold uppercase tracking-[0.2em]"
              style={{ color: paperInkSoft }}
            >
              Find us at
            </p>
            <p
              className={`leading-tight text-balance line-clamp-2 ${format.locationClass}`}
              style={{ fontFamily: t.serif, color: paperInk }}
            >
              {state.location}
            </p>
            <p className="text-[11px] font-medium" style={{ color: paperInkSoft }}>
              {state.hoursStart} — {state.hoursEnd}
            </p>
          </div>

          {/* Menu — bounded so it never collides with the QR footer */}
          {state.menu.length > 0 && (
            <div className="flex-1 min-h-0 overflow-hidden flex items-center">
              <ul className="text-left w-full max-w-[18rem] mx-auto overflow-hidden">
                {state.menu.slice(0, format.menuLimit).map((item, i, arr) => (
                  <li
                    key={item.id}
                    className={`flex justify-between items-baseline gap-2 ${format.menuItemClass}`}
                    style={{
                      color: paperInk,
                      borderBottom: i < arr.length - 1 ? `1px dashed ${paperDivider}` : "none",
                    }}
                  >
                    <span className="truncate font-medium">{item.name}</span>
                    <span className="font-bold shrink-0" style={{ color: t.accent }}>
                      ${item.price}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className={`shrink-0 flex flex-col ${format.footerClass}`}>
          {/* Order Ahead */}
          <div
            className={`w-full rounded-xl font-bold uppercase tracking-widest text-center truncate ${format.orderClass}`}
            style={{ backgroundColor: t.accent, color: t.accentText }}
          >
            Order Ahead{domain ? ` · ${domain}` : ""}
          </div>

          {/* QR — protected footer, always fully visible and unobstructed */}
          <div className="flex min-h-0 flex-1 items-center justify-center gap-3">
            <div
              className={`rounded-lg p-1.5 grid place-items-center bg-white shrink-0 ${format.qrSize}`}
              style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }}
            >
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Scan to order"
                  width={160}
                  height={160}
                  className="size-full object-contain"
                />
              ) : (
                <span className="text-[9px] text-black/40">QR</span>
              )}
            </div>
            <div className="min-w-0 text-left">
              <p
                className="text-[8px] font-bold uppercase tracking-[0.2em]"
                style={{ color: paperInkSoft }}
              >
                Scan to order
              </p>
              <p
                className={`font-semibold leading-tight line-clamp-2 ${format.qrNameClass}`}
                style={{ fontFamily: t.serif, color: paperInk }}
              >
                {state.name}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------- Catering Owner View ------------------------------- */

/**
 * Owner Dashboard View for Catering.
 * - Editable settings that power the public /catering form
 * - Preview + link to public customer form
 * - List of received inquiries (from localStorage)
 * - Social post generator (images + captions) like the flyer tool
 */
function CateringOwnerView({
  state,
  setState,
  onDone,
}: {
  state: TruckState;
  setState: (s: TruckState) => void;
  onDone: () => void;
}) {
  const [profile, setProfile] = useState<CateringProfile | null>(null);
  const [inquiries, setInquiries] = useState<CateringInquiry[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [socialFormat, setSocialFormat] = useState<ShareFormat>("portrait");
  const [busy, setBusy] = useState<null | "png" | "share">(null);
  const [toast, setToast] = useState<string | null>(null);

  // Photo for the social graphic (local to this session; allows owner to use their own realistic food/event photo)
  const [socialPhoto, setSocialPhoto] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const socialRef = useRef<HTMLDivElement | null>(null);

  // Load profile + inquiries via the clean dataService abstraction (localStorage demo)
  useEffect(() => {
    getProfile().then(setProfile);
    getInquiries().then(setInquiries);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000); // ~3 seconds as specified
    return () => clearTimeout(t);
  }, [toast]);

  const handleSocialPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSocialPhoto(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // reset for re-upload
  };

  const resetSocialPhoto = () => setSocialPhoto(null);

  const triggerPhotoUpload = () => photoInputRef.current?.click();

  // Profile editing via dataService (modular for future Supabase)
  const updateProfile = async (patch: Partial<CateringProfile>) => {
    if (!profile) return;
    const updated = { ...profile, ...patch };
    setProfile(updated);
    await saveProfile(updated);
  };

  const updatePackage = (id: string, patch: Partial<CateringProfile["signaturePackages"][0]>) => {
    if (!profile) return;
    const next = profile.signaturePackages.map((p) => (p.id === id ? { ...p, ...patch } : p));
    updateProfile({ signaturePackages: next });
  };

  const addPackage = () => {
    if (!profile) return;
    const next = [
      ...profile.signaturePackages,
      {
        id: crypto.randomUUID(),
        name: "New Package",
        description: "Describe the offering",
        serves: "Serves 20–30",
      },
    ];
    updateProfile({ signaturePackages: next });
  };

  const removePackage = (id: string) => {
    if (!profile) return;
    updateProfile({
      signaturePackages: profile.signaturePackages.filter((p) => p.id !== id),
    });
  };

  const markContacted = async (id: string) => {
    await markInquiryContacted(id);
    const updated = await getInquiries();
    setInquiries(updated);
  };

  const copyPublicLink = async () => {
    const url = `${window.location.origin}/catering`;
    try {
      await navigator.clipboard.writeText(url);
      setToast("Public form link copied");
    } catch {
      setToast("Link: " + url);
    }
  };

  /* ---------- Social generator for catering promos (re-uses patterns from flyer & this-week) ---------- */

  const openSocial = () => setSocialOpen(true);
  const closeSocial = () => setSocialOpen(false);

  // Robust capture helpers (modeled after the proven flyer tool)
  const captureCateringBlob = async () => {
    if (!socialRef.current) return null;
    // pixelRatio 3 on a 380px base → ~1140px wide output — perfect for IG/FB (1080+)
    return await toBlob(socialRef.current, {
      pixelRatio: 3,
      cacheBust: true,
      backgroundColor: "#f5efe1",
    });
  };

  const downloadCateringImage = async () => {
    if (!socialRef.current) return;
    setBusy("png");
    try {
      const dataUrl = await toPng(socialRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: "#f5efe1",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${slug(state.name)}-catering.png`;
      a.click();
      setToast("Image downloaded successfully");
    } catch (e) {
      console.error(e);
      setToast("Couldn't export image. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const shareCatering = async () => {
    setBusy("share");
    try {
      const blob = await captureCateringBlob();
      const caption = buildCateringCaption(state);
      const link = `${window.location.origin}/catering`;

      // Simulate share: always copy the public link to clipboard (as per requirements)
      await navigator.clipboard.writeText(link);

      if (blob && navigator.canShare) {
        const file = new File([blob], `${slug(state.name)}-catering.png`, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `${state.name} Catering`,
            text: caption,
          });
          setToast("Ready to share! Link copied to clipboard.");
          closeSocial();
          return;
        }
      }
      if (navigator.share) {
        await navigator.share({ title: `${state.name} Catering`, text: caption });
        setToast("Ready to share! Link copied to clipboard.");
        closeSocial();
        return;
      }

      setToast("Ready to share! Link copied to clipboard.");
    } catch (e: unknown) {
      if ((e as { name?: string })?.name !== "AbortError") {
        console.error(e);
        // fallback
        const link = `${window.location.origin}/catering`;
        await navigator.clipboard.writeText(link).catch(() => {});
        setToast("Ready to share! Link copied to clipboard.");
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-6 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl">Catering</h2>
          <p className="text-xs text-brand-green/60">Manage inquiries, settings &amp; promotion</p>
        </div>
        <button
          onClick={onDone}
          className="text-xs font-bold uppercase tracking-wider text-brand-orange"
        >
          Done
        </button>
      </div>

      {/* Settings — now driven by the dataService profile (scalable) */}
      <div className="bg-white rounded-3xl border border-brand-green/10 p-5 space-y-4">
        <div className="font-semibold">Your Catering Profile</div>

        {!profile ? (
          <div className="text-sm text-brand-green/60">Loading profile…</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Owner Notification Email">
                <input
                  type="email"
                  value={profile.notificationEmail}
                  onChange={(e) => updateProfile({ notificationEmail: e.target.value })}
                  className="w-full bg-brand-sand rounded-2xl px-3 py-2.5 text-sm border border-brand-green/10"
                  placeholder="you@yourtruck.com"
                />
              </Field>
              {/* Phone kept for convenience / display in public form but not part of core profile service yet */}
              <Field label="Contact Phone (display)">
                <input
                  value={state.phone}
                  onChange={(e) => setState({ ...state, phone: e.target.value })}
                  className="w-full bg-brand-sand rounded-2xl px-3 py-2.5 text-sm border border-brand-green/10"
                />
              </Field>
            </div>

            <Field label="Service Area">
              <input
                value={profile.serviceArea}
                onChange={(e) => updateProfile({ serviceArea: e.target.value })}
                className="w-full bg-brand-sand rounded-2xl px-3 py-2.5 text-sm border border-brand-green/10"
              />
            </Field>

            <Field label="Public Intro Message (shown on form)">
              <textarea
                value={profile.introMessage}
                onChange={(e) => updateProfile({ introMessage: e.target.value })}
                rows={3}
                className="w-full bg-brand-sand rounded-2xl px-3 py-2.5 text-sm border border-brand-green/10"
              />
            </Field>

            {/* Signature packages */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold uppercase tracking-wider text-brand-green/60">
                  Signature Packages
                </div>
                <button onClick={addPackage} className="text-xs text-brand-orange font-bold">
                  + Add
                </button>
              </div>
              <div className="space-y-2">
                {profile.signaturePackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center bg-brand-sand rounded-2xl p-2"
                  >
                    <input
                      value={pkg.name}
                      onChange={(e) => updatePackage(pkg.id, { name: e.target.value })}
                      className="bg-white rounded-xl px-2 py-1 text-sm"
                    />
                    <input
                      value={pkg.serves}
                      onChange={(e) => updatePackage(pkg.id, { serves: e.target.value })}
                      className="bg-white rounded-xl px-2 py-1 text-xs"
                    />
                    <button
                      onClick={() => removePackage(pkg.id)}
                      className="text-brand-green/40 px-2"
                    >
                      ×
                    </button>
                    <input
                      value={pkg.description}
                      onChange={(e) => updatePackage(pkg.id, { description: e.target.value })}
                      className="col-span-3 bg-white rounded-xl px-2 py-1 text-xs mt-1"
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setShowPreview(true)}
          className="px-4 py-2 rounded-2xl border border-brand-green/15 bg-white text-sm font-semibold"
        >
          Preview Public Form
        </button>
        <button
          onClick={copyPublicLink}
          className="px-4 py-2 rounded-2xl border border-brand-green/15 bg-white text-sm font-semibold"
        >
          Copy Public Link
        </button>
        <button
          onClick={openSocial}
          className="px-4 py-2 rounded-2xl bg-brand-orange text-white text-sm font-bold"
        >
          Generate Social Post
        </button>
        <a
          href="/catering"
          target="_blank"
          rel="noopener"
          className="px-4 py-2 rounded-2xl border border-brand-green/15 bg-white text-sm font-semibold"
        >
          Open Public Page ↗
        </a>
      </div>

      {/* Inquiries */}
      <div>
        <div className="flex items-baseline justify-between mb-2 px-1">
          <div className="font-semibold">Recent Inquiries</div>
          <div className="text-[10px] text-brand-green/50">{inquiries.length} total</div>
        </div>

        {inquiries.length === 0 ? (
          <div className="bg-white rounded-3xl border border-brand-green/10 p-6 text-sm text-brand-green/60">
            No inquiries yet. Share your public link from above or the This Week page to start
            receiving requests.
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-brand-green/10 overflow-hidden text-sm divide-y divide-brand-green/10">
            {inquiries.slice(0, 8).map((inq) => (
              <div key={inq.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">
                    {inq.name}{" "}
                    <span className="text-xs text-brand-green/50">· {inq.eventType}</span>
                  </div>
                  <div className="text-xs text-brand-green/70 truncate">
                    {inq.eventDate} {inq.eventTime} • {inq.guests} guests • {inq.location}
                  </div>
                  <div className="text-[10px] text-brand-green/50 truncate mt-0.5">
                    {inq.email} {inq.phone ? `· ${inq.phone}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`px-2 py-0.5 rounded ${inq.status === "new" ? "bg-brand-orange/10 text-brand-orange" : "bg-brand-green/10 text-brand-green"}`}
                  >
                    {inq.status}
                  </span>
                  {inq.status === "new" && (
                    <button
                      onClick={() => markContacted(inq.id)}
                      className="underline text-brand-green/70"
                    >
                      Mark contacted
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-center text-brand-green/50">
        Inquiries are stored on this device and sync with the public form.
      </p>

      {/* Public form preview modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setShowPreview(false)} className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-3xl max-w-md w-full max-h-[85vh] overflow-auto p-5 shadow-2xl">
            <div className="flex justify-between mb-3">
              <div className="font-semibold">Public Form Preview</div>
              <button onClick={() => setShowPreview(false)} className="text-brand-orange text-sm">
                Close
              </button>
            </div>
            <div className="text-xs text-brand-green/60 mb-3 border-b pb-2">
              This is what customers see at /catering
            </div>
            {/* Simple visual representation */}
            <div className="space-y-3 text-sm">
              <div className="font-display text-xl">{state.name} Catering</div>
              <p className="text-brand-green/70 text-sm">
                {profile?.introMessage || "Bring authentic flavors to your next event..."}
              </p>
              <div className="bg-brand-sand rounded-2xl p-3 text-xs">
                Name, Email, Phone, Date/Time, Guests, Location, Event Type, Menu/Dietary, Budget,
                Notes
              </div>
              <div className="pt-2 text-[10px] text-brand-green/50">
                Full interactive form available on the live public page.
              </div>
            </div>
            <a
              href="/catering"
              target="_blank"
              className="mt-4 block text-center py-2 rounded-2xl bg-brand-orange text-white text-sm font-bold"
            >
              Open Full Public Form
            </a>
          </div>
        </div>
      )}

      {/* Social post studio modal (catering promo) */}
      {socialOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
          <button onClick={closeSocial} className="absolute inset-0 bg-black/40" />
          <div className="relative bg-brand-sand w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5">
            <div className="flex justify-between mb-3">
              <div className="font-semibold">Generate Catering Post</div>
              <button onClick={closeSocial}>Done</button>
            </div>

            <div className="flex gap-2 mb-3">
              {(["portrait", "story", "square"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setSocialFormat(f)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-2xl border ${socialFormat === f ? "bg-brand-green text-white border-brand-green" : "bg-white"}`}
                >
                  {f === "portrait" ? "4:5 Post" : f === "story" ? "9:16 Story" : "1:1 Square"}
                </button>
              ))}
            </div>

            {/* Photo chooser for the social graphic - allows realistic local food photo */}
            <div className="flex items-center gap-2 mb-2 text-xs">
              <span className="font-bold uppercase tracking-wider text-brand-green/60">Photo</span>
              <button
                onClick={triggerPhotoUpload}
                className="px-2.5 py-1 rounded-full border border-brand-green/15 bg-white text-brand-green hover:bg-brand-sand"
              >
                Upload own photo
              </button>
              {socialPhoto && (
                <button onClick={resetSocialPhoto} className="text-brand-green/60 underline">
                  Reset
                </button>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleSocialPhotoUpload}
              />
            </div>

            {/* Larger, fixed-base-size preview so export is ~1080px and not zoomed/cropped */}
            <div className="mx-auto mb-4" style={{ width: 380 }}>
              <div className="overflow-hidden rounded-3xl ring-1 ring-brand-green/10 bg-white">
                <CateringSocialCard
                  ref={socialRef}
                  state={state}
                  format={socialFormat}
                  photo={socialPhoto}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={downloadCateringImage}
                disabled={busy !== null}
                className="py-3 rounded-2xl bg-brand-green text-white font-bold text-sm"
              >
                {busy === "png" ? "Rendering..." : "Download Image"}
              </button>
              <button
                onClick={shareCatering}
                disabled={busy !== null}
                className="py-3 rounded-2xl bg-brand-orange text-white font-bold text-sm"
              >
                {busy === "share" ? "..." : "Share"}
              </button>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(buildCateringCaption(state));
                setToast("Caption copied to clipboard");
              }}
              className="mt-2 w-full py-2 text-xs"
            >
              Copy Caption
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#1a3d2e] text-[#f5efe1] border border-[#b8722c]/40 px-5 py-2.5 rounded-full text-sm font-medium shadow-lg shadow-black/20"
          role="status"
        >
          {toast}
        </div>
      )}
    </section>
  );
}

/* Reusable high-quality social card for catering promos.
 * Designed for ~1080px output (base render ~360-380px * pixelRatio 3).
 * Warm Kentucky aesthetic, prominent realistic photo placeholder + upload support,
 * clear hierarchy, conversion-focused CTA. Matches flyer tool quality.
 */
const CateringSocialCard = React.forwardRef<
  HTMLDivElement,
  { state: TruckState; format: ShareFormat; photo?: string | null }
>(({ state, format, photo }, ref) => {
  const aspect =
    format === "portrait" ? "aspect-[4/5]" : format === "story" ? "aspect-[9/16]" : "aspect-square";

  // Use provided upload or the project's food photo asset (realistic, on-brand)
  const heroSrc = photo || flyerFood;

  // Keep service area friendly and short for the graphic
  const areaLabel = "Lake Cumberland & Central Kentucky";

  return (
    <div
      ref={ref}
      className={`${aspect} relative overflow-hidden flex flex-col`}
      style={{
        background: "#f5efe1",
        color: "#1a3d2e",
        width: "100%", // controlled by parent fixed-width wrapper
        fontFamily: "var(--font-sans, system-ui)",
      }}
    >
      {/* Prominent hero photo section (top ~52%) */}
      <div className="relative" style={{ height: "52%" }}>
        <img
          src={heroSrc}
          alt="Catering food spread - Bluegrass Kitchen"
          className="absolute inset-0 w-full h-full object-cover"
          crossOrigin="anonymous"
        />
        {/* Subtle vignette for premium feel */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.25) 70%, rgba(0,0,0,0.45) 100%)",
          }}
        />
        {/* Badge over photo */}
        <div
          className="absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-bold tracking-[0.2em] shadow"
          style={{ background: "#b8722c", color: "#fffdf6" }}
        >
          CATERING AVAILABLE
        </div>
      </div>

      {/* Text + CTA area */}
      <div className="flex-1 px-5 pt-4 pb-5 flex flex-col items-center text-center justify-between">
        {/* Truck name + headline */}
        <div>
          <div
            className="font-display text-[27px] leading-[1.05] font-bold tracking-[-0.4px]"
            style={{ color: "#1a3d2e" }}
          >
            {state.name}
          </div>
          <div
            className="mt-0.5 text-[17px] font-semibold tracking-tight"
            style={{ color: "#b8722c" }}
          >
            Catering Available
          </div>
        </div>

        {/* Service area */}
        <div className="text-[11px] font-medium tracking-wide text-[#4a4a4a] -mt-1">
          {areaLabel}
        </div>

        {/* Prominent CTA "button" - looks clickable in the post */}
        <div
          className="inline-flex items-center justify-center px-5 py-[7px] rounded-[14px] text-xs font-extrabold tracking-[0.15em] shadow-sm"
          style={{ background: "#1a3d2e", color: "#f5efe1" }}
        >
          INQUIRE → /CATERING
        </div>

        {/* Warm tagline */}
        <div className="text-[10px] opacity-70 tracking-[0.5px] -mt-1">
          Honest food. Local roots.
        </div>
      </div>
    </div>
  );
});

/* ------------------------------- Settings ------------------------------- */

function SettingsSheet({
  state,
  setState,
  onClose,
}: {
  state: TruckState;
  setState: (s: TruckState) => void;
  onClose: () => void;
}) {
  // Settings only mounts on client after user opens it — still avoid reading
  // storage in useState initializers so the first paint is stable if SSR ever mounts it.
  const [syncOn, setSyncOn] = useState(false);
  const [truckId, setTruckId] = useState(DEFAULT_TRUCK_ID);
  const [pendingSync, setPendingSync] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    setSyncOn(isSupabaseSyncEnabled());
    setTruckId(getConfiguredTruckId());
    setPendingSync(hasPendingCloudSync());
    getOwnerSessionEmail().then(setOwnerEmail);
  }, []);

  const toggleSync = (next: boolean) => {
    setSyncOn(next);
    setSupabaseSyncEnabled(next);
    if (next) void flushPendingCloudSync();
  };

  const saveTruckId = (value: string) => {
    setTruckId(value);
    setConfiguredTruckId(value || DEFAULT_TRUCK_ID);
  };

  const handleAuth = async (mode: "in" | "up") => {
    setAuthBusy(true);
    setAuthMsg(null);
    try {
      if (mode === "in") await signInOwner(authEmail.trim(), authPassword);
      else await signUpOwner(authEmail.trim(), authPassword);
      const email = await getOwnerSessionEmail();
      setOwnerEmail(email);
      setAuthMsg(
        mode === "in"
          ? "Signed in — ready to publish to Supabase."
          : "Account created. Check email if confirmation is required, then sign in.",
      );
      setAuthPassword("");
      void flushPendingCloudSync();
    } catch (e) {
      setAuthMsg(e instanceof Error ? e.message : "Auth failed");
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button
        onClick={onClose}
        aria-label="Close settings"
        className="absolute inset-0 bg-brand-green/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md bg-brand-sand rounded-t-[2rem] sm:rounded-3xl p-6 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-baseline">
          <h2 className="font-display text-2xl">Settings</h2>
          <button
            onClick={onClose}
            className="text-xs font-bold uppercase tracking-wider text-brand-orange"
          >
            Done
          </button>
        </div>

        <Field label="Truck name">
          <input
            value={state.name}
            onChange={(e) => setState({ ...state, name: e.target.value })}
            className="w-full bg-white rounded-xl px-4 py-3 text-sm font-medium border border-brand-green/10 focus:outline-none focus:border-brand-orange"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Hours start">
            <input
              value={state.hoursStart}
              onChange={(e) => setState({ ...state, hoursStart: e.target.value })}
              className="w-full bg-white rounded-xl px-4 py-3 text-sm font-medium border border-brand-green/10 focus:outline-none focus:border-brand-orange"
            />
          </Field>
          <Field label="Hours end">
            <input
              value={state.hoursEnd}
              onChange={(e) => setState({ ...state, hoursEnd: e.target.value })}
              className="w-full bg-white rounded-xl px-4 py-3 text-sm font-medium border border-brand-green/10 focus:outline-none focus:border-brand-orange"
            />
          </Field>
        </div>

        <Field
          label="Order-ahead URL"
          hint="Square, Google Form, your website — used on the flyer button and QR code."
        >
          <input
            type="url"
            inputMode="url"
            placeholder="https://order.square.site/..."
            value={state.orderUrl}
            onChange={(e) => setState({ ...state, orderUrl: e.target.value })}
            className="w-full bg-white rounded-xl px-4 py-3 text-sm font-medium border border-brand-green/10 focus:outline-none focus:border-brand-orange"
          />
        </Field>

        {/* Supabase Sync */}
        <div className="rounded-2xl bg-white border border-brand-green/10 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-orange">
                Cloud website sync
              </div>
              <h3 className="font-display text-lg mt-0.5">Use Supabase Sync</h3>
              <p className="text-xs text-brand-green/65 mt-1 leading-relaxed">
                Push menu &amp; schedule to Supabase so any phone can load your public site — not
                just this device. localStorage still works offline.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={syncOn}
              onClick={() => toggleSync(!syncOn)}
              className={`shrink-0 mt-1 w-12 h-7 rounded-full transition relative ${
                syncOn ? "bg-brand-orange" : "bg-brand-green/20"
              }`}
            >
              <span
                className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition ${
                  syncOn ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <p className="text-[11px] text-brand-green/55">
            Status:{" "}
            <span className={configured ? "text-brand-green font-semibold" : "text-brand-orange"}>
              {getSupabaseConfigHint()}
            </span>
            {pendingSync && (
              <span className="text-brand-orange font-semibold"> · Offline publish queued</span>
            )}
          </p>

          <Field
            label="Truck ID"
            hint="Public slug for your truck (e.g. bluegrass-kitchen). Customers load this via ?truck=…"
          >
            <input
              value={truckId}
              onChange={(e) => saveTruckId(e.target.value)}
              placeholder={DEFAULT_TRUCK_ID}
              className="w-full bg-brand-sand rounded-xl px-4 py-3 text-sm font-medium border border-brand-green/10 focus:outline-none focus:border-brand-orange"
            />
          </Field>

          {syncOn && (
            <div className="space-y-2 pt-1 border-t border-brand-green/10">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-green/50">
                Owner sign-in (optional)
              </p>
              {ownerEmail ? (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-brand-green/80">{ownerEmail}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await signOutOwner();
                      setOwnerEmail(null);
                    }}
                    className="text-xs font-bold text-brand-orange shrink-0"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@truck.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full bg-brand-sand rounded-xl px-4 py-2.5 text-sm border border-brand-green/10 focus:outline-none focus:border-brand-orange"
                  />
                  <input
                    type="password"
                    autoComplete="current-password"
                    placeholder="Password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full bg-brand-sand rounded-xl px-4 py-2.5 text-sm border border-brand-green/10 focus:outline-none focus:border-brand-orange"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={authBusy || !authEmail || !authPassword}
                      onClick={() => handleAuth("in")}
                      className="flex-1 py-2.5 rounded-xl bg-brand-green text-white text-xs font-bold disabled:opacity-50"
                    >
                      Sign in
                    </button>
                    <button
                      type="button"
                      disabled={authBusy || !authEmail || !authPassword}
                      onClick={() => handleAuth("up")}
                      className="flex-1 py-2.5 rounded-xl border border-brand-green/20 text-brand-green text-xs font-bold disabled:opacity-50"
                    >
                      Create account
                    </button>
                  </div>
                </>
              )}
              {authMsg && <p className="text-[11px] text-brand-green/70 leading-snug">{authMsg}</p>}
            </div>
          )}

          <details className="text-xs text-brand-green/65">
            <summary className="cursor-pointer font-semibold text-brand-green list-none flex items-center gap-1">
              <span className="text-brand-orange">▸</span> Connection instructions
            </summary>
            <ol className="mt-2 space-y-1.5 list-decimal list-inside leading-relaxed pl-0.5">
              <li>
                SQL → run{" "}
                <code className="text-[10px] bg-brand-sand px-1 rounded">
                  supabase/storage_buckets.sql
                </code>{" "}
                (creates public <strong>menu-data</strong> + <strong>menu-images</strong>).
              </li>
              <li>
                <strong>Lovable Cloud:</strong> Workspace Settings → Privacy &amp; security → turn{" "}
                <em>off</em> “Block public storage buckets” so Cluckin Chaos can use the public URL.
              </li>
              <li>
                Env:{" "}
                <code className="text-[10px] bg-brand-sand px-1 rounded">VITE_SUPABASE_URL</code>{" "}
                +{" "}
                <code className="text-[10px] bg-brand-sand px-1 rounded">
                  VITE_SUPABASE_PUBLISHABLE_KEY
                </code>{" "}
                (or ANON_KEY). Default truck id:{" "}
                <code className="text-[10px] bg-brand-sand px-1 rounded">cluckin-chaos</code>.
              </li>
              <li>
                Home → <strong>Publish Updates to My Website</strong> → writes{" "}
                <code className="text-[10px] bg-brand-sand px-1 rounded">
                  menu-data/cluckin-chaos/menu.json
                </code>
                .
              </li>
            </ol>
          </details>
        </div>

        <div className="rounded-2xl bg-brand-green/5 border border-brand-green/10 p-4 text-xs text-brand-green/70 leading-relaxed">
          <span className="font-semibold text-brand-green">Coming soon:</span> Square integration to
          sync menu &amp; orders automatically.
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-green/60">
        {label}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-brand-green/50 leading-snug">{hint}</span>}
    </label>
  );
}

type TabKey = "home" | "menu" | "flyer" | "catering"; // "week" moved to dedicated route, catering has owner tools + public form at /catering

function BottomNav({ tab, setTab }: { tab: TabKey; setTab: (t: TabKey) => void }) {
  const items: { key: TabKey | "week"; label: string; icon: React.ReactNode; to?: string }[] = [
    { key: "home", label: "Home", icon: <HomeIcon className="size-5" /> },
    {
      key: "week",
      label: "This Week",
      icon: <CalendarIcon className="size-5" />,
      to: "/this-week",
    },
    { key: "catering", label: "Catering", icon: <CateringIcon className="size-5" /> },
    { key: "menu", label: "Menu", icon: <ForkKnifeIcon className="size-5" /> },
    { key: "flyer", label: "Flyer", icon: <SparklesIcon className="size-5" /> },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/85 backdrop-blur-xl border-t border-brand-green/5 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] print:hidden">
      <div className="max-w-md mx-auto flex justify-around items-center">
        {items.map((it) => {
          if (it.to) {
            // Dedicated route for This Week — always navigates (no internal tab)
            return (
              <Link
                key={it.key}
                to={it.to}
                className="flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition text-brand-green/40 hover:text-brand-orange"
              >
                {it.icon}
                <span className="text-[10px] font-bold uppercase tracking-wider">{it.label}</span>
              </Link>
            );
          }
          const active = tab === it.key;
          return (
            <button
              key={it.key}
              onClick={() => setTab(it.key as TabKey)}
              className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition ${
                active ? "text-brand-orange" : "text-brand-green/40"
              }`}
            >
              {it.icon}
              <span className="text-[10px] font-bold uppercase tracking-wider">{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function CalendarIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function CateringIcon(p: React.SVGProps<SVGSVGElement>) {
  // Simple warm plate + event icon for catering
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M12 2v20" />
      <path d="M2 7h20" />
      <path d="M5 12c0 3.87 3.13 7 7 7s7-3.13 7-7" />
      <path d="M19 7v2" />
    </svg>
  );
}

function PrinterIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M6 9V3h12v6" />
      <rect x="4" y="9" width="16" height="8" rx="2" />
      <path d="M6 17h12v4H6z" />
    </svg>
  );
}

function WeekPreviewCard({ schedule }: { schedule: ScheduleDay[] }) {
  const upcoming = schedule.filter((d) => !d.closed).slice(0, 3);
  return (
    <section className="bg-white rounded-3xl p-5 border border-brand-green/5 shadow-sm">
      <div className="flex justify-between items-baseline mb-3">
        <h3 className="font-display text-lg">This Week</h3>
        <Link
          to="/this-week"
          className="text-[11px] text-brand-orange font-bold uppercase tracking-wider"
        >
          View &amp; Edit
        </Link>
      </div>
      <ul className="space-y-2">
        {upcoming.map((d) => (
          <li key={d.id} className="flex items-center gap-3">
            <span className="shrink-0 min-w-11 text-center px-2 py-1 rounded-lg bg-brand-orange text-white text-[11px] font-bold tracking-wider">
              {d.day}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-brand-green truncate">{d.neighborhood}</p>
              <p className="text-[11px] text-brand-green/60 truncate">
                {d.spot} · {d.hoursStart}–{d.hoursEnd}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* 
  Note: The full "This Week" editor with print + rich social image export now lives
  at the dedicated /this-week route. The preview card on Home still links there.
  Old tab-based editor removed to keep a single source of truth for schedule editing.
*/

function PrintableSchedule({ state }: { state: TruckState }) {
  // Date is client-timezone sensitive — set after mount so SSR HTML matches first paint
  const hydrated = useHydrated();
  const [dateLabel, setDateLabel] = useState("");
  useEffect(() => {
    if (!hydrated) return;
    setDateLabel(formatWeekOf());
  }, [hydrated]);
  return (
    <div className="printable-schedule hidden print:block print-hidden">
      <header className="print-header">
        <div>
          <p className="print-eyebrow">Weekly Schedule</p>
          <h1 className="print-title">{state.name}</h1>
          <p className="print-sub" suppressHydrationWarning>
            Week of {dateLabel || "…"}
          </p>
        </div>
        <div className="print-brand">Bluegrass · Kentucky</div>
      </header>

      <table className="print-table">
        <thead>
          <tr>
            <th style={{ width: "12%" }}>Day</th>
            <th style={{ width: "28%" }}>Neighborhood</th>
            <th style={{ width: "38%" }}>Spot</th>
            <th style={{ width: "22%" }}>Hours</th>
          </tr>
        </thead>
        <tbody>
          {state.schedule.map((d) => (
            <tr key={d.id} className={d.closed ? "row-closed" : ""}>
              <td className="cell-day">{d.day}</td>
              <td>{d.closed ? d.note || "Closed" : d.neighborhood}</td>
              <td>{d.closed ? "—" : d.spot}</td>
              <td>{d.closed ? "—" : `${d.hoursStart} – ${d.hoursEnd}`}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="print-footer">
        <p>Hours may shift for weather &amp; events. Call {state.phone}</p>
        {state.orderUrl && <p className="print-order">Order ahead: {state.orderUrl}</p>}
      </footer>
    </div>
  );
}

/* ------------------------------- Helpers ------------------------------- */

function buildCaption(state: TruckState) {
  const parts = [
    `🚚 ${state.name} — ${state.live ? "OPEN today" : "Today's menu"}`,
    `📍 ${state.location}`,
    `🕐 ${state.hoursStart} – ${state.hoursEnd}`,
    `⭐️ Special: ${state.special}`,
  ];
  if (state.orderUrl) parts.push(`Order ahead → ${state.orderUrl}`);
  return parts.join("\n");
}

function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "flyer"
  );
}

function initials(s: string) {
  return s
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* clipboard may be unavailable */
  }
}

function buildCateringCaption(state: TruckState) {
  return [
    `🍽️ ${state.name} now taking catering bookings!`,
    `Perfect for weddings, corporate events, festivals & private parties.`,
    `Lake Cumberland area — authentic Kentucky flavors.`,
    `Inquire here: ${window.location.origin}/catering`,
  ].join("\n");
}
function PinIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

/* ---------- Icons ---------- */

function PencilIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
function ForkKnifeIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M6 3v8a2 2 0 0 0 4 0V3M8 11v10" />
      <path d="M17 3c-1.5 1-2.5 3-2.5 5.5S15.5 13 17 13v8" />
    </svg>
  );
}
function SparklesIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z" />
      <path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
    </svg>
  );
}
function HomeIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}

function GlobeIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10" />
    </svg>
  );
}
function PlusIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      {...p}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function XIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      {...p}
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
function GearIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
