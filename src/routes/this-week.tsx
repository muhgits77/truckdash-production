import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useRef, useState } from "react";
import { toBlob, toPng } from "html-to-image";
import {
  type ScheduleDay,
  type TruckState,
  DEFAULT_SCHEDULE,
  useTruckState,
} from "@/lib/truck-state";
import { publishData, getPublishedData, buildPublishPayloadFromState } from "@/lib/publishService";
import { formatPublishedShort, formatPublishedTime, formatWeekOf } from "@/lib/format-local";
import { useHydrated } from "@/hooks/use-hydrated";

export const Route = createFileRoute("/this-week")({
  head: () => ({
    meta: [
      { title: "This Week — Bluegrass Kitchen | TruckDash" },
      {
        name: "description",
        content:
          "Edit your weekly schedule for Bluegrass Kitchen. Print professional copies or generate beautiful social-ready images.",
      },
    ],
  }),
  component: ThisWeekPage,
});

/** Social image export formats matching the style of the existing flyer tool */
type SocialFormat = "portrait" | "story" | "square";

const SOCIAL_FORMATS: {
  id: SocialFormat;
  label: string;
  aspect: string;
  description: string;
}[] = [
  {
    id: "portrait",
    label: "Post 4:5",
    aspect: "aspect-[4/5]",
    description: "Instagram / Facebook feed",
  },
  {
    id: "story",
    label: "Story 9:16",
    aspect: "aspect-[9/16]",
    description: "Instagram / FB Stories",
  },
  {
    id: "square",
    label: "Square 1:1",
    aspect: "aspect-square",
    description: "Instagram grid / posts",
  },
];

/**
 * Main "This Week" Schedule Page
 * - Full 7-day editable cards
 * - Auto + explicit save to localStorage (shared with dashboard)
 * - Print-optimized professional table output
 * - Social image generation with multiple aspect ratios (like flyer)
 */
function ThisWeekPage() {
  // ---- Hooks only (always top-level, never conditional) ----
  const hydrated = useHydrated();
  const [state, setState] = useTruckState();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [socialOpen, setSocialOpen] = useState(false);
  const [socialFormat, setSocialFormat] = useState<SocialFormat>("portrait");
  const [busy, setBusy] = useState<null | "print" | "png" | "share">(null);
  const [toast, setToast] = useState<string | null>(null);
  // Publish labels: empty on SSR + first paint (timezone-safe after mount)
  const [lastPubLabel, setLastPubLabel] = useState<string | null>(null);
  const [pubBusy, setPubBusy] = useState(false);
  // Locale dates for print + social export — set only after hydrate
  const [weekOfLabel, setWeekOfLabel] = useState("");
  const [weekOfShortLabel, setWeekOfShortLabel] = useState("This Week");
  const socialRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    let mounted = true;
    getPublishedData()
      .then((p) => {
        if (!mounted) return;
        if (p.lastPublished) setLastPubLabel(formatPublishedShort(p.lastPublished));
      })
      .catch(() => {
        /* non-fatal — local board still works */
      });
    return () => {
      mounted = false;
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const full = formatWeekOf();
    setWeekOfLabel(full);
    setWeekOfShortLabel(full.replace(/,\s*\d{4}$/, ""));
  }, [hydrated]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // ---- Derived (not hooks) ----
  const schedule = state.schedule;

  const handlePublishFromWeek = async () => {
    setPubBusy(true);
    try {
      const payload = buildPublishPayloadFromState(state);
      const result = await publishData(payload);
      setLastPubLabel(formatPublishedShort(result.published.lastPublished));
      const t = formatPublishedTime(result.published.lastPublished);
      if (result.source === "supabase")
        setToast(result.message || `Published to Supabase at ${t} + menu.json`);
      else if (result.source === "local+queued")
        setToast(result.message || `Saved at ${t} — cloud pending`);
      else if (result.source === "json")
        setToast(result.message || `Published at ${t} — menu.json downloaded`);
      else setToast(result.message || `Published to website at ${t}`);
    } catch {
      setToast("Publish failed");
    } finally {
      setPubBusy(false);
    }
  };

  // Update a single day's fields. Live edit + persist via the hook.
  const updateDay = (id: string, patch: Partial<ScheduleDay>) => {
    const next = schedule.map((d) => (d.id === id ? { ...d, ...patch } : d));
    setState({ ...state, schedule: next });
  };

  // Explicit save (useful feedback even though auto-persisted)
  const handleSave = () => {
    // Force a write (the hook already does this on change, but we give confirmation)
    try {
      localStorage.setItem("truckdash.state.v1", JSON.stringify(state));
      setSaveMsg("Saved to this device");
      setTimeout(() => setSaveMsg(null), 1800);
    } catch {
      setSaveMsg("Could not save");
      setTimeout(() => setSaveMsg(null), 1800);
    }
  };

  // Reset to a clean default schedule (great for starting a fresh week)
  const resetWeek = () => {
    if (!confirm("Replace current schedule with the default weekly template?")) return;
    setState({ ...state, schedule: DEFAULT_SCHEDULE });
    setToast("Loaded default weekly template");
  };

  /* ---------------- Print (professional table) ---------------- */

  const doPrint = () => {
    setBusy("print");
    // Add body class so global print styles can show the printable block if needed,
    // but we also render a dedicated print block inside this page.
    document.body.classList.add("printing-schedule");
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove("printing-schedule");
        setBusy(null);
      }, 400);
    }, 60);
  };

  /* ---------------- Social Image Generation ---------------- */

  const openSocial = () => setSocialOpen(true);
  const closeSocial = () => setSocialOpen(false);

  const captureSocialBlob = async () => {
    if (!socialRef.current) return null;
    // High-res export for crisp social posts
    return await toBlob(socialRef.current, {
      pixelRatio: 3,
      cacheBust: true,
      backgroundColor: "#f5efe1", // brand sand/cream
    });
  };

  const downloadSocialPng = async () => {
    if (!socialRef.current) return;
    setBusy("png");
    try {
      const dataUrl = await toPng(socialRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: "#f5efe1",
      });
      const a = document.createElement("a");
      const fmt = SOCIAL_FORMATS.find((f) => f.id === socialFormat)!;
      a.href = dataUrl;
      a.download = `bluegrass-kitchen-this-week-${fmt.id}.png`;
      a.click();
      setToast("Image saved — ready for Instagram or Facebook");
    } catch (e) {
      console.error(e);
      setToast("Couldn't generate image");
    } finally {
      setBusy(null);
    }
  };

  const shareSocialNative = async () => {
    setBusy("share");
    try {
      const blob = await captureSocialBlob();
      const caption = buildWeeklyCaption(state, schedule);

      if (blob && navigator.canShare) {
        const file = new File([blob], `bluegrass-kitchen-this-week.png`, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `${state.name} — This Week`,
            text: caption,
          });
          setToast("Shared!");
          closeSocial();
          return;
        }
      }
      if (navigator.share) {
        await navigator.share({ title: `${state.name} — This Week`, text: caption });
        closeSocial();
        return;
      }
      // Fallback: copy caption + suggest download
      await navigator.clipboard.writeText(caption);
      setToast("Caption copied. Use Download for the image.");
    } catch (e: unknown) {
      if ((e as { name?: string })?.name !== "AbortError") {
        console.error(e);
      }
    } finally {
      setBusy(null);
    }
  };

  // Quick text copy helper for the whole schedule (easy to paste into posts or group chats)
  const copyTextSchedule = async () => {
    const text = buildWeeklyCaption(state, schedule);
    try {
      await navigator.clipboard.writeText(text);
      setToast("Weekly schedule copied as text");
    } catch {
      setToast("Copy failed — check permissions");
    }
  };

  return (
    <div className="min-h-screen bg-brand-sand text-brand-green pb-24">
      {/* Top nav / branding */}
      <header className="sticky top-0 z-40 bg-brand-sand/90 backdrop-blur-md border-b border-brand-green/10 px-4 py-3">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-brand-green/60 hover:text-brand-green transition">
              ← Home
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-brand-orange" />
                <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-brand-orange">
                  Bluegrass Kitchen
                </span>
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight leading-none">
                This Week
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={resetWeek}
              className="text-[11px] px-3 py-1.5 rounded-full border border-brand-green/15 text-brand-green/70 hover:bg-white/60 transition"
            >
              Reset week
            </button>
            <Link
              to="/"
              className="text-[11px] px-3 py-1.5 rounded-full bg-white border border-brand-green/10 text-brand-green font-semibold"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-6 space-y-6">
        {/* Intro + actions */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-sm text-brand-green/70 max-w-prose">
              Update locations, hours, and notes for the week. Everything saves automatically to
              this device. Perfect for printing or posting on social each Monday.
            </p>
            {lastPubLabel && (
              <p className="text-[11px] text-brand-orange mt-1" suppressHydrationWarning>
                Last published to website: {lastPubLabel}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSave}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white border border-brand-green/10 px-4 py-2 text-sm font-bold active:scale-[0.985] transition"
            >
              Save Changes
            </button>
            <button
              onClick={copyTextSchedule}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white border border-brand-green/10 px-4 py-2 text-sm font-bold active:scale-[0.985] transition"
            >
              Copy as Text
            </button>
            <button
              onClick={handlePublishFromWeek}
              disabled={pubBusy}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-orange text-white px-4 py-2 text-sm font-bold active:scale-[0.985] transition disabled:opacity-70"
            >
              {pubBusy ? "Publishing…" : "Publish to My Website"}
            </button>
          </div>
        </div>

        {saveMsg && (
          <div className="text-center text-sm font-medium text-brand-orange">{saveMsg}</div>
        )}

        {/* Editable schedule — warm premium card layout, mobile + desktop friendly */}
        <div className="space-y-3">
          {schedule.map((day) => (
            <ScheduleDayCard
              key={day.id}
              day={day}
              onChange={(patch) => updateDay(day.id, patch)}
            />
          ))}
        </div>

        {/* Primary actions — Print + Social Share (core of the feature request) */}
        <div className="pt-2 grid gap-3 sm:grid-cols-2">
          <button
            onClick={doPrint}
            disabled={busy !== null}
            className="w-full flex items-center justify-center gap-3 bg-brand-green text-white font-bold py-4 rounded-3xl shadow-lg shadow-brand-green/20 active:scale-[0.985] transition disabled:opacity-70"
          >
            <PrinterIcon className="size-5" />
            {busy === "print" ? "Preparing print…" : "Print Schedule"}
          </button>

          <button
            onClick={openSocial}
            disabled={busy !== null}
            className="w-full flex items-center justify-center gap-3 bg-brand-orange text-white font-bold py-4 rounded-3xl shadow-lg shadow-brand-orange/20 active:scale-[0.985] transition disabled:opacity-70"
          >
            <ShareIcon className="size-5" />
            Share on Social
          </button>
        </div>

        <p className="text-center text-[11px] text-brand-green/50 max-w-md mx-auto">
          Print creates a clean professional table with Bluegrass Kitchen branding.
          <br />
          Social creates beautiful image cards sized for Instagram &amp; Facebook.
        </p>

        {/* Helpful Kentucky-local tip */}
        <div className="mx-auto max-w-md text-center text-xs text-brand-green/60 pt-2">
          Tip: Keep neighborhood names short and recognizable (Downtown Monticello, Lake Cumberland,
          etc.). Add festival or event names in the Notes field.
        </div>

        {/* Integration: Link from This Week to Catering (per spec) */}
        <div className="mt-2 bg-white border border-brand-green/10 rounded-3xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1">
            <div className="font-semibold">Hosting an event?</div>
            <p className="text-sm text-brand-green/70">
              Book {state.name} for private catering or a full truck experience.
            </p>
          </div>
          <Link
            to="/catering"
            className="shrink-0 inline-flex items-center px-4 py-2 rounded-2xl bg-brand-orange text-white text-sm font-bold"
          >
            Inquire about catering →
          </Link>
        </div>

        {/* Dedicated print-only content for this page (beautiful header + table) */}
        <PrintableWeeklySchedule state={state} weekOfLabel={weekOfLabel} />
      </main>

      {/*
        Social export card always mounted (off-screen when closed) so ref + capture
        stay stable and no child-only hooks mount/unmount with the modal.
      */}
      <div
        className={
          socialOpen
            ? "fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
            : "fixed left-[-9999px] top-0 w-[380px] pointer-events-none opacity-0"
        }
        aria-hidden={!socialOpen}
      >
        {socialOpen && (
          <button
            aria-label="Close social studio"
            onClick={closeSocial}
            className="absolute inset-0 bg-black/40 backdrop-blur"
          />
        )}
        <div
          className={
            socialOpen
              ? "relative w-full max-w-xl bg-brand-sand rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-auto"
              : "relative w-[380px]"
          }
        >
          {socialOpen && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="uppercase tracking-[0.2em] text-[10px] font-bold text-brand-orange">
                    Bluegrass Kitchen
                  </div>
                  <h3 className="font-display text-2xl">Share This Week</h3>
                </div>
                <button onClick={closeSocial} className="text-brand-green/60 font-bold px-2">
                  Done
                </button>
              </div>

              <div className="mb-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-brand-green/60 mb-1.5">
                  Image size
                </div>
                <div className="flex gap-2">
                  {SOCIAL_FORMATS.map((fmt) => {
                    const active = socialFormat === fmt.id;
                    return (
                      <button
                        key={fmt.id}
                        onClick={() => setSocialFormat(fmt.id)}
                        className={`flex-1 py-2.5 rounded-2xl border text-sm font-bold transition ${
                          active
                            ? "bg-brand-green text-white border-brand-green"
                            : "bg-white text-brand-green border-brand-green/10"
                        }`}
                      >
                        {fmt.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-brand-green/50 mt-1.5">
                  {SOCIAL_FORMATS.find((f) => f.id === socialFormat)?.description}
                </p>
              </div>
            </>
          )}

          <div className={socialOpen ? "mb-4" : ""}>
            {socialOpen && (
              <div className="text-[10px] font-bold uppercase tracking-wider text-brand-green/60 mb-2">
                Preview
              </div>
            )}
            <div
              className={
                socialOpen
                  ? "rounded-3xl overflow-hidden ring-1 ring-brand-green/10 bg-white p-1.5"
                  : ""
              }
            >
              <SocialScheduleCard
                ref={socialRef}
                state={state}
                schedule={schedule}
                format={socialFormat}
                weekLabel={weekOfShortLabel}
              />
            </div>
          </div>

          {socialOpen && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={downloadSocialPng}
                  disabled={busy !== null}
                  className="w-full bg-brand-green text-white font-semibold py-3 rounded-2xl active:scale-[0.985] disabled:opacity-60"
                >
                  {busy === "png" ? "Rendering…" : "Download PNG"}
                </button>
                <button
                  onClick={shareSocialNative}
                  disabled={busy !== null}
                  className="w-full bg-brand-orange text-white font-semibold py-3 rounded-2xl active:scale-[0.985] disabled:opacity-60"
                >
                  {busy === "share" ? "Preparing…" : "Share Image"}
                </button>
                <button
                  onClick={copyTextSchedule}
                  className="w-full border border-brand-green/20 text-brand-green font-semibold py-3 rounded-2xl active:scale-[0.985]"
                >
                  Copy Caption
                </button>
              </div>

              <p className="text-center text-[10px] text-brand-green/50 pt-4">
                High-resolution export. Use on Instagram, Facebook, or stories. Looks great printed
                too.
              </p>
            </>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-brand-green text-white text-sm font-medium px-5 py-2.5 rounded-full shadow-xl z-[80]">
          {toast}
        </div>
      )}

      {/* Footer */}
      <footer className="text-center pt-8 pb-6 text-[10px] text-brand-green/40">
        TruckDash · Bluegrass Kitchen · Kentucky
      </footer>
    </div>
  );
}

/* ---------------- Schedule Day Editor Card ---------------- */

function ScheduleDayCard({
  day,
  onChange,
}: {
  day: ScheduleDay;
  onChange: (patch: Partial<ScheduleDay>) => void;
}) {
  const isClosed = !!day.closed;

  return (
    <article
      className={`bg-white rounded-3xl border border-brand-green/8 shadow-sm overflow-hidden transition ${isClosed ? "opacity-80" : ""}`}
    >
      <div className="flex flex-col sm:flex-row">
        {/* Day badge — warm accent */}
        <div className="w-full sm:w-20 shrink-0 bg-brand-orange text-white flex items-center justify-center py-3 sm:py-0">
          <div className="text-center">
            <div className="font-bold text-xl tracking-[1px]">{day.day}</div>
            {isClosed && (
              <div className="text-[9px] uppercase tracking-widest opacity-80 -mt-0.5">Closed</div>
            )}
          </div>
        </div>

        {/* Editable fields */}
        <div className="flex-1 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Neighborhood / Location */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-brand-green/60 mb-1">
                Neighborhood / Area
              </label>
              <input
                value={day.neighborhood}
                onChange={(e) => onChange({ neighborhood: e.target.value })}
                className="w-full bg-brand-sand rounded-xl px-3.5 py-2.5 text-sm font-semibold border border-transparent focus:border-brand-orange outline-none"
                placeholder="e.g. Downtown Monticello"
              />
            </div>

            {/* Specific Spot */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-brand-green/60 mb-1">
                Specific Spot
              </label>
              <input
                value={day.spot}
                onChange={(e) => onChange({ spot: e.target.value })}
                className="w-full bg-brand-sand rounded-xl px-3.5 py-2.5 text-sm border border-transparent focus:border-brand-orange outline-none"
                placeholder="e.g. Courthouse Square or 123 Main St"
              />
            </div>
          </div>

          {/* Hours */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-brand-green/60 mb-1">
                Opens
              </label>
              <input
                value={day.hoursStart}
                onChange={(e) => onChange({ hoursStart: e.target.value })}
                className="w-full bg-brand-sand rounded-xl px-3.5 py-2.5 text-sm border border-transparent focus:border-brand-orange outline-none"
                placeholder="11:00 AM"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-brand-green/60 mb-1">
                Closes
              </label>
              <input
                value={day.hoursEnd}
                onChange={(e) => onChange({ hoursEnd: e.target.value })}
                className="w-full bg-brand-sand rounded-xl px-3.5 py-2.5 text-sm border border-transparent focus:border-brand-orange outline-none"
                placeholder="2:00 PM"
              />
            </div>
          </div>

          {/* Notes — e.g. "Festival", "Prep day", "Closed", event info */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-brand-green/60 mb-1">
              Notes (visible on print &amp; social)
            </label>
            <input
              value={day.note || ""}
              onChange={(e) => onChange({ note: e.target.value })}
              className="w-full bg-brand-sand rounded-xl px-3.5 py-2.5 text-sm border border-transparent focus:border-brand-orange outline-none"
              placeholder="Festival, private event, prep day, family day…"
            />
          </div>

          {/* Closed toggle */}
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isClosed}
              onChange={(e) => onChange({ closed: e.target.checked })}
              className="size-4 accent-brand-orange"
            />
            <span className="font-medium text-brand-green/80">Closed / prep / off this day</span>
          </label>
        </div>
      </div>
    </article>
  );
}

/* ---------------- Social Card (exportable) ---------------- */
/**
 * Beautiful weekly schedule graphic.
 * Designed to feel premium + warm Kentucky: clean typography, bourbon/cream palette,
 * honest layout. Matches the "elevated but never cold" brand direction.
 */
/**
 * Pure presentational export card — no hooks.
 * weekLabel is prepared by the parent after hydrate so SSR/client first paint match.
 */
const SocialScheduleCard = React.forwardRef<
  HTMLDivElement,
  {
    state: TruckState;
    schedule: ScheduleDay[];
    format: SocialFormat;
    weekLabel: string;
  }
>(({ state, schedule, format, weekLabel }, ref) => {
  const fmt = SOCIAL_FORMATS.find((f) => f.id === format) ?? SOCIAL_FORMATS[0];
  const rows = schedule;

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden rounded-[2.1rem] p-4 sm:p-5 ${fmt.aspect}`}
      style={{
        background: "linear-gradient(180deg, #f5efe1 0%, #f0e7d4 100%)",
        color: "#1a3d2e",
        fontFamily: "var(--font-sans)",
        boxShadow: "0 10px 30px -15px rgba(26,61,46,0.25)",
      }}
    >
      {/* Subtle local texture / warmth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E\")",
          backgroundSize: "140px",
          mixBlendMode: "multiply",
        }}
      />

      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#1a3d2e]/15">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-[0.18em] bg-[#b8722c] text-white">
              BLUEGRASS KITCHEN
            </div>
            <div className="font-display text-[22px] sm:text-[26px] leading-none font-bold tracking-[-0.3px] mt-1.5">
              This Week
            </div>
            <div className="text-sm text-[#1a3d2e]/70 mt-0.5" suppressHydrationWarning>
              Week of {weekLabel}
            </div>
          </div>
          <div className="text-right text-xs leading-tight text-[#1a3d2e]/60 font-medium">
            Kentucky
            <br />
            Bluegrass
          </div>
        </div>

        {/* Schedule rows — clean, readable, warm */}
        <div className="flex-1 py-3 space-y-2.5 overflow-hidden text-[13px]">
          {rows.map((d, i) => {
            const closed = !!d.closed;
            return (
              <div
                key={i}
                className={`flex gap-3 items-baseline rounded-xl px-3 py-1.5 ${closed ? "opacity-60" : ""}`}
                style={{ background: closed ? "rgba(0,0,0,0.025)" : "transparent" }}
              >
                <div className="w-11 shrink-0 font-bold tracking-[0.5px] text-[#b8722c]">
                  {d.day}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold leading-tight">
                    {closed ? d.note || "Closed" : d.neighborhood}
                  </div>
                  {!closed && (
                    <div className="text-[#1a3d2e]/70 text-[12px] truncate">{d.spot}</div>
                  )}
                </div>
                <div className="text-right font-medium text-sm whitespace-nowrap tabular-nums">
                  {closed ? "—" : `${d.hoursStart}–${d.hoursEnd}`}
                </div>
                {d.note && !closed && (
                  <div className="hidden sm:block text-[10px] font-medium px-2 py-0.5 rounded bg-[#b8722c]/10 text-[#b8722c] max-w-[110px] truncate">
                    {d.note}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer branding */}
        <div className="pt-3 mt-auto border-t border-[#1a3d2e]/15 flex items-center justify-between text-xs">
          <div>
            <span className="font-semibold">{state.name}</span>
            {state.phone && <span className="text-[#1a3d2e]/60"> · {state.phone}</span>}
          </div>
          {state.orderUrl && (
            <div className="text-[#b8722c] font-medium truncate max-w-[42%] text-right">
              Order ahead
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

/* ---------------- Print-optimized professional table (page-specific) ---------------- */
/** This block is only visible when printing from /this-week. No hooks — date from parent. */
function PrintableWeeklySchedule({
  state,
  weekOfLabel,
}: {
  state: TruckState;
  weekOfLabel: string;
}) {
  return (
    <div className="print-only-schedule hidden print:block mt-8 text-[#111] bg-white p-8 rounded-none">
      <div className="max-w-[7.5in] mx-auto">
        {/* Beautiful header matching brand */}
        <div className="border-b-2 border-[#1a3d2e] pb-3 mb-5 flex items-end justify-between">
          <div>
            <div className="uppercase tracking-[3px] text-[10px] font-bold text-[#b8722c]">
              Bluegrass Kitchen — Kentucky
            </div>
            <div className="font-display text-4xl font-bold tracking-[-0.4px] text-[#1a3d2e] mt-1">
              Weekly Schedule
            </div>
            <div className="text-[#4a4a4a] mt-0.5" suppressHydrationWarning>
              Week of {weekOfLabel || "…"}
            </div>
          </div>
          <div className="font-display text-xl italic text-[#1a3d2e]">
            Honest food. Local roots.
          </div>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#1a3d2e]">
              <th className="py-2.5 text-left font-bold tracking-widest text-xs text-white bg-[#1a3d2e] px-4">
                DAY
              </th>
              <th className="py-2.5 text-left font-bold tracking-widest text-xs text-white bg-[#1a3d2e] px-4">
                NEIGHBORHOOD
              </th>
              <th className="py-2.5 text-left font-bold tracking-widest text-xs text-white bg-[#1a3d2e] px-4">
                SPOT
              </th>
              <th className="py-2.5 text-left font-bold tracking-widest text-xs text-white bg-[#1a3d2e] px-4">
                HOURS
              </th>
            </tr>
          </thead>
          <tbody>
            {state.schedule.map((d, idx) => {
              const closed = !!d.closed;
              return (
                <tr key={idx} className={closed ? "text-[#8c8c8c] italic" : ""}>
                  <td className="border-b border-[#e6e0d0] px-4 py-3 font-extrabold tracking-[0.5px] text-[#b8722c]">
                    {d.day}
                  </td>
                  <td className="border-b border-[#e6e0d0] px-4 py-3">
                    {closed ? d.note || "Closed" : d.neighborhood}
                  </td>
                  <td className="border-b border-[#e6e0d0] px-4 py-3">{closed ? "—" : d.spot}</td>
                  <td className="border-b border-[#e6e0d0] px-4 py-3 font-medium">
                    {closed ? "—" : `${d.hoursStart} – ${d.hoursEnd}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-5 pt-4 border-t border-[#1a3d2e] text-xs text-[#4a4a4a] flex flex-col sm:flex-row gap-x-4 gap-y-1">
          <div>Hours subject to change for weather and events.</div>
          {state.phone && <div>Call {state.phone}</div>}
          {state.orderUrl && (
            <div className="font-semibold text-[#b8722c]">Order ahead: {state.orderUrl}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Helpers ---------------- */

function buildWeeklyCaption(state: TruckState, schedule: ScheduleDay[]) {
  const lines: string[] = [];
  lines.push(`🚚 ${state.name} — This Week`);
  const openDays = schedule.filter((d) => !d.closed);
  if (openDays.length) {
    openDays.forEach((d) => {
      lines.push(
        `${d.day}: ${d.neighborhood} · ${d.spot} · ${d.hoursStart}–${d.hoursEnd}${d.note ? ` (${d.note})` : ""}`,
      );
    });
  }
  if (state.phone) lines.push(`📞 ${state.phone}`);
  if (state.orderUrl) lines.push(`Order ahead: ${state.orderUrl}`);
  lines.push("Bluegrass Kitchen • Kentucky");
  return lines.join("\n");
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

function ShareIcon(p: React.SVGProps<SVGSVGElement>) {
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
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51 15.42 17.49" />
      <path d="M15.41 6.51 8.59 10.49" />
    </svg>
  );
}
