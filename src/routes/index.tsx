import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { toBlob, toPng } from "html-to-image";
import flyerFood from "@/assets/flyer-food.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "TruckDash — Food Truck Dashboard & Flyer Studio" }],
  }),
  component: Dashboard,
});

type MenuItem = { id: string; name: string; price: string };

type TemplateId =
  | "bright"
  | "bbq"
  | "moody"
  | "minimal"
  | "boldbbq"
  | "rustic"
  | "clean";

type TruckState = {
  name: string;
  live: boolean;
  location: string;
  hoursStart: string;
  hoursEnd: string;
  special: string;
  menu: MenuItem[];
  orderUrl: string;
  template: TemplateId;
  heroPhoto?: string; // data URL of user-uploaded flyer photo
};

const DEFAULT_STATE: TruckState = {
  name: "Nacho Galley",
  live: true,
  location: "Arts District Central",
  hoursStart: "12:00 PM",
  hoursEnd: "9:00 PM",
  special: "Kimchi Loaded Nachos",
  menu: [
    { id: "1", name: "Loaded Nachos", price: "12" },
    { id: "2", name: "Al Pastor Tacos (3)", price: "11" },
    { id: "3", name: "Elote Cup", price: "6" },
    { id: "4", name: "Horchata", price: "5" },
  ],
  orderUrl: "https://order.example.com/nacho-galley",
  template: "bright",
};

const APP_VERSION = "0.2.0";
const STORAGE_KEY = "truckdash.state.v1";
const VERSION_KEY = "truckdash.version";
const ONBOARD_KEY = "truckdash.onboarded.v1";

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

function useTruckState() {
  const [state, setState] = useState<TruckState>(DEFAULT_STATE);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...DEFAULT_STATE, ...JSON.parse(raw) });
    } catch {}
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  return [state, setState] as const;
}

function Dashboard() {
  const [state, setState] = useTruckState();
  const [tab, setTab] = useState<"home" | "menu" | "flyer">("home");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const flyerRef = useRef<HTMLDivElement | null>(null);
  const menuHighlights = useMemo(() => state.menu.slice(0, 3), [state.menu]);

  return (
    <div className="min-h-screen bg-brand-sand text-brand-green pb-28">
      <Header state={state} setState={setState} onOpenSettings={() => setSettingsOpen(true)} />

      <main className="mx-auto max-w-md px-4 pt-4 space-y-6">
        {tab === "home" && (
          <>
            <StatusCard state={state} setState={setState} />
            <QuickActions
              onOpenMenu={() => setTab("menu")}
              onOpenFlyer={() => setTab("flyer")}
            />
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
      </main>

      <BottomNav tab={tab} setTab={setTab} />

      {settingsOpen && (
        <SettingsSheet state={state} setState={setState} onClose={() => setSettingsOpen(false)} />
      )}
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
        <h1 className="font-display text-xl font-bold tracking-tight truncate leading-tight">
          {state.name}
        </h1>
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

function StatusCard({
  state,
  setState,
}: {
  state: TruckState;
  setState: (s: TruckState) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <section className="bg-brand-green text-white rounded-3xl p-6 shadow-xl shadow-brand-green/15">
      <div className="flex justify-between items-start mb-5 gap-3">
        <div className="min-w-0 space-y-1 flex-1">
          <p className="text-brand-gold text-[10px] font-bold uppercase tracking-[0.2em]">
            Current Spot
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
}: {
  onOpenMenu: () => void;
  onOpenFlyer: () => void;
}) {
  return (
    <section className="grid grid-cols-2 gap-4">
      <button
        onClick={onOpenMenu}
        className="flex flex-col items-center justify-center gap-3 bg-white p-5 rounded-3xl border border-brand-green/5 shadow-sm active:scale-[0.98] transition"
      >
        <div className="size-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange">
          <ForkKnifeIcon className="size-6" />
        </div>
        <span className="text-sm font-semibold text-brand-green">Edit Menu</span>
      </button>
      <button
        onClick={onOpenFlyer}
        className="flex flex-col items-center justify-center gap-3 bg-white p-5 rounded-3xl border border-brand-green/5 shadow-sm active:scale-[0.98] transition"
      >
        <div className="size-12 rounded-2xl bg-brand-gold/15 flex items-center justify-center text-brand-green">
          <SparklesIcon className="size-6" />
        </div>
        <span className="text-sm font-semibold text-brand-green">Design Flyer</span>
      </button>
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
          <li
            key={item.id}
            className="flex justify-between items-center py-3 first:pt-0 last:pb-0"
          >
            <span className="text-sm font-medium truncate pr-3">{item.name}</span>
            <span className="text-sm font-semibold text-brand-orange shrink-0">
              ${item.price}
            </span>
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
      menu: [
        ...state.menu,
        { id: crypto.randomUUID(), name: "New item", price: "0" },
      ],
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

      <div className="bg-white rounded-3xl border border-brand-green/5 shadow-sm divide-y divide-brand-green/5">
        {state.menu.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[minmax(0,1fr)_5rem_auto] items-center gap-2 p-3"
          >
            <input
              value={item.name}
              onChange={(e) => updateItem(item.id, { name: e.target.value })}
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
        ))}
      </div>

      <button
        onClick={addItem}
        className="w-full flex items-center justify-center gap-2 bg-white border border-dashed border-brand-green/20 text-brand-green font-semibold py-4 rounded-2xl active:scale-[0.99] transition"
      >
        <PlusIcon className="size-4" /> Add menu item
      </button>

      <div className="rounded-2xl bg-brand-green/5 border border-brand-green/10 p-4 text-xs text-brand-green/70 leading-relaxed">
        <span className="font-semibold text-brand-green">Coming soon:</span> pull your menu
        straight from Square and add an order-ahead link to every flyer.
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
  const [busy, setBusy] = useState<null | "png" | "share" | "fb" | "ig">(null);
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

  const shareInstagram = async () => {
    setBusy("ig");
    try {
      const blob = await captureBlob();
      const caption = buildCaption(state);
      if (blob && navigator.canShare) {
        const file = new File([blob], `${slug(state.name)}-flyer.png`, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: caption });
          return;
        }
      }
      if (blob) triggerDownload(blob, `${slug(state.name)}-flyer.png`);
      await copyText(caption);
      setToast("Flyer saved · caption copied — post in Instagram");
    } catch (e: unknown) {
      if ((e as { name?: string })?.name !== "AbortError") console.error(e);
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

      <TemplatePicker
        value={state.template}
        onChange={(t) => setState({ ...state, template: t })}
      />

      <Flyer state={state} ref={flyerRef} />

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={shareNative}
          disabled={busy !== null}
          className="bg-brand-orange text-white font-bold py-4 rounded-2xl shadow-lg shadow-brand-orange/25 active:scale-[0.98] transition disabled:opacity-60"
        >
          {busy === "share" ? "Preparing…" : "Share Flyer"}
        </button>
        <button
          onClick={downloadPng}
          disabled={busy !== null}
          className="bg-brand-green text-white font-bold py-4 rounded-2xl shadow-lg shadow-brand-green/25 active:scale-[0.98] transition disabled:opacity-60"
        >
          {busy === "png" ? "Rendering…" : "Download PNG"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <ShareChip
          label={busy === "ig" ? "…" : "Instagram"}
          onClick={shareInstagram}
          disabled={busy !== null}
        />
        <ShareChip
          label={busy === "fb" ? "…" : "Facebook"}
          onClick={shareFacebook}
          disabled={busy !== null}
        />
        <ShareChip
          label="Copy Text"
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

function TemplatePicker({
  value,
  onChange,
}: {
  value: TemplateId;
  onChange: (t: TemplateId) => void;
}) {
  const ids: TemplateId[] = ["bright", "boldbbq", "rustic", "clean", "bbq", "moody", "minimal"];
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

const Flyer = ({
  state,
  ref,
}: {
  state: TruckState;
  ref: React.MutableRefObject<HTMLDivElement | null>;
}) => {
  const t = TEMPLATES[state.template];
  const qrTarget = state.orderUrl || "https://truckdash.app";
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
      className="relative overflow-hidden rounded-[2.25rem] p-1.5 shadow-2xl"
      style={{ backgroundColor: t.frame, boxShadow: `0 20px 40px -20px ${t.frame}55` }}
    >
      <div
        className="rounded-[1.85rem] overflow-hidden"
        style={{ backgroundColor: t.paper, color: t.ink }}
      >
        {/* Hero */}
        <div className="relative w-full aspect-[4/5]">
          {t.hero === "photo" ? (
            <img
              src={flyerFood}
              alt=""
              width={1080}
              height={1350}
              className="absolute inset-0 size-full object-cover"
              crossOrigin="anonymous"
            />
          ) : (
            <div
              className="absolute inset-0 grid place-items-center"
              style={{
                background: `radial-gradient(circle at 30% 20%, ${t.accent}22, transparent 60%), ${t.paper}`,
              }}
            >
              <span
                className="text-[10rem] leading-none font-bold italic"
                style={{ fontFamily: t.serif, color: t.ink, opacity: 0.08 }}
              >
                {initials(state.name)}
              </span>
            </div>
          )}
          <div
            className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur"
            style={{ backgroundColor: `${t.paper}ee`, color: t.ink }}
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
        <div className="p-7 text-center space-y-4">
          <div
            className="inline-block px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ backgroundColor: t.accent, color: t.accentText }}
          >
            Today's Special
          </div>
          <h4
            className="text-3xl leading-tight italic text-balance"
            style={{ fontFamily: t.serif, color: t.ink }}
          >
            {state.special}
          </h4>
          <div className="h-px w-12 mx-auto" style={{ backgroundColor: t.divider }} />

          <div className="space-y-1">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{ color: t.inkSoft }}
            >
              Find us at
            </p>
            <p className="text-xl text-balance" style={{ fontFamily: t.serif, color: t.ink }}>
              {state.location}
            </p>
            <p className="text-sm font-medium" style={{ color: t.inkSoft }}>
              {state.hoursStart} — {state.hoursEnd}
            </p>
          </div>

          {state.menu.length > 0 && (
            <ul className="text-left max-w-[16rem] mx-auto pt-2 space-y-1.5">
              {state.menu.slice(0, 4).map((item) => (
                <li
                  key={item.id}
                  className="flex justify-between text-sm pb-1.5"
                  style={{
                    color: t.ink,
                    borderBottom: `1px dashed ${t.divider}`,
                  }}
                >
                  <span className="truncate pr-2 font-medium">{item.name}</span>
                  <span className="font-semibold" style={{ color: t.accent }}>
                    ${item.price}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Order Ahead */}
          <div className="pt-2">
            <div
              className="w-full py-3.5 px-5 rounded-2xl text-sm font-bold uppercase tracking-widest text-center"
              style={{ backgroundColor: t.accent, color: t.accentText }}
            >
              Order Ahead
            </div>
            {domain && (
              <p
                className="text-[10px] mt-1.5 font-semibold tracking-widest uppercase"
                style={{ color: t.inkSoft }}
              >
                {domain}
              </p>
            )}
          </div>

          {/* QR */}
          <div className="pt-3 flex flex-col items-center gap-2">
            <div
              className="size-24 rounded-xl p-2 grid place-items-center"
              style={{ backgroundColor: `${t.ink}0d` }}
            >
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Scan to order"
                  width={160}
                  height={160}
                  className="size-full"
                />
              ) : (
                <span className="text-[9px]" style={{ color: t.inkSoft }}>
                  QR
                </span>
              )}
            </div>
            <p
              className="text-[9px] font-bold uppercase tracking-[0.2em]"
              style={{ color: t.inkSoft }}
            >
              Scan · Order · Follow
            </p>
          </div>

          <div className="pt-2 border-t" style={{ borderColor: t.divider }}>
            <p className="text-lg" style={{ fontFamily: t.serif, color: t.ink }}>
              {state.name}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

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

        <div className="rounded-2xl bg-brand-green/5 border border-brand-green/10 p-4 text-xs text-brand-green/70 leading-relaxed">
          <span className="font-semibold text-brand-green">Coming soon:</span> Square integration
          to sync menu & orders automatically.
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

function BottomNav({
  tab,
  setTab,
}: {
  tab: "home" | "menu" | "flyer";
  setTab: (t: "home" | "menu" | "flyer") => void;
}) {
  const items: { key: typeof tab; label: string; icon: React.ReactNode }[] = [
    { key: "home", label: "Home", icon: <HomeIcon className="size-5" /> },
    { key: "menu", label: "Menu", icon: <ForkKnifeIcon className="size-5" /> },
    { key: "flyer", label: "Flyer", icon: <SparklesIcon className="size-5" /> },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/85 backdrop-blur-xl border-t border-brand-green/5 px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] print:hidden">
      <div className="max-w-md mx-auto flex justify-around items-center">
        {items.map((it) => {
          const active = tab === it.key;
          return (
            <button
              key={it.key}
              onClick={() => setTab(it.key)}
              className={`flex flex-col items-center gap-1 py-1.5 px-4 rounded-2xl transition ${
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
  } catch {}
}

/* ---------- Icons ---------- */

function PencilIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
function ForkKnifeIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 3v8a2 2 0 0 0 4 0V3M8 11v10" />
      <path d="M17 3c-1.5 1-2.5 3-2.5 5.5S15.5 13 17 13v8" />
    </svg>
  );
}
function SparklesIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z" />
      <path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
    </svg>
  );
}
function HomeIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}
function PlusIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function XIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
function GearIcon(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
