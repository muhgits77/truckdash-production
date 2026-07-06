import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import flyerFood from "@/assets/flyer-food.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:image", content: "https://id-preview--58991d74-931b-4bef-bb57-6e09504e9fbb.lovable.app/icon-512.png" },
    ],
  }),
  component: Dashboard,
});

type MenuItem = { id: string; name: string; price: string };

type TruckState = {
  name: string;
  live: boolean;
  location: string;
  hoursStart: string;
  hoursEnd: string;
  special: string;
  menu: MenuItem[];
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
};

const STORAGE_KEY = "truckpost.state.v1";

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
  const flyerRef = useRef<HTMLDivElement | null>(null);

  const menuHighlights = useMemo(() => state.menu.slice(0, 3), [state.menu]);

  return (
    <div className="min-h-screen bg-brand-sand text-brand-green pb-28">
      <Header state={state} setState={setState} />

      <main className="mx-auto max-w-md px-4 pt-4 space-y-6">
        {tab === "home" && (
          <>
            <StatusCard state={state} setState={setState} />
            <QuickActions onOpenMenu={() => setTab("menu")} onOpenFlyer={() => setTab("flyer")} />
            <MenuHighlightsCard items={menuHighlights} onEdit={() => setTab("menu")} />
            <FlyerSection state={state} flyerRef={flyerRef} />
          </>
        )}

        {tab === "menu" && <MenuManager state={state} setState={setState} onDone={() => setTab("home")} />}

        {tab === "flyer" && <FlyerSection state={state} flyerRef={flyerRef} standalone />}
      </main>

      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}

function Header({ state, setState }: { state: TruckState; setState: (s: TruckState) => void }) {
  return (
    <header className="sticky top-0 z-40 bg-brand-sand/85 backdrop-blur-md border-b border-brand-green/5 px-6 py-4 flex justify-between items-center">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight truncate">{state.name}</h1>
        <p className="text-[10px] font-semibold text-brand-green/60 uppercase tracking-[0.2em] mt-0.5">
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
    </header>
  );
}

function StatusCard({ state, setState }: { state: TruckState; setState: (s: TruckState) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <section className="bg-brand-green text-white rounded-3xl p-6 shadow-xl shadow-brand-green/15">
      <div className="flex justify-between items-start mb-5">
        <div className="min-w-0 space-y-1">
          <p className="text-brand-gold text-[10px] font-bold uppercase tracking-[0.2em]">Current Spot</p>
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
          <p className="text-[10px] uppercase opacity-60 mb-1 font-semibold tracking-wider">Special</p>
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
        <span className="text-sm font-semibold text-brand-green">Generate Flyer</span>
      </button>
    </section>
  );
}

function MenuHighlightsCard({ items, onEdit }: { items: MenuItem[]; onEdit: () => void }) {
  return (
    <section className="bg-white rounded-3xl p-5 border border-brand-green/5 shadow-sm">
      <div className="flex justify-between items-baseline mb-3">
        <h3 className="font-display text-lg">Menu Highlights</h3>
        <button onClick={onEdit} className="text-[11px] text-brand-orange font-bold uppercase tracking-wider">
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
        <button onClick={onDone} className="text-xs font-bold uppercase tracking-wider text-brand-orange">
          Done
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-brand-green/5 shadow-sm divide-y divide-brand-green/5">
        {state.menu.map((item) => (
          <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_5rem_auto] items-center gap-2 p-3">
            <input
              value={item.name}
              onChange={(e) => updateItem(item.id, { name: e.target.value })}
              className="min-w-0 bg-transparent text-sm font-medium outline-none px-2 py-2 rounded-lg focus:bg-brand-sand"
            />
            <div className="flex items-center gap-1 rounded-lg focus-within:bg-brand-sand px-2">
              <span className="text-brand-green/40 text-sm">$</span>
              <input
                value={item.price}
                onChange={(e) => updateItem(item.id, { price: e.target.value.replace(/[^\d.]/g, "") })}
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
        <span className="font-semibold text-brand-green">Coming soon:</span> pull your menu straight
        from Square and add an order-ahead link to every flyer.
      </div>
    </section>
  );
}

function FlyerSection({
  state,
  flyerRef,
  standalone = false,
}: {
  state: TruckState;
  flyerRef: React.MutableRefObject<HTMLDivElement | null>;
  standalone?: boolean;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleShare = async (target: "native" | "instagram" | "facebook" | "copy") => {
    const shareText = `${state.name} — today at ${state.location}, ${state.hoursStart}–${state.hoursEnd}. Special: ${state.special}.`;
    if (target === "copy") {
      try {
        await navigator.clipboard.writeText(shareText);
      } catch {}
      return;
    }
    if (target === "facebook") {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}&quote=${encodeURIComponent(shareText)}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    if (target === "instagram") {
      // Instagram has no web share intent — prompt user to save & post.
      try {
        await navigator.clipboard.writeText(shareText);
      } catch {}
      alert("Flyer caption copied. Save the flyer image (long-press below) and post to Instagram.");
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: state.name, text: shareText, url: window.location.href });
      } catch {}
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    // Give the button state a beat, then trigger print (works cross-browser for saving flyer).
    setTimeout(() => {
      window.print();
      setDownloading(false);
    }, 150);
  };

  return (
    <section className="space-y-4">
      <div className="flex justify-between items-baseline">
        <h3 className="font-display text-lg">{standalone ? "Today's Flyer" : "Daily Flyer"}</h3>
        <span className="text-[11px] text-brand-orange font-bold uppercase tracking-wider">
          Auto-generated
        </span>
      </div>

      <Flyer state={state} ref={flyerRef} />

      <button
        onClick={() => handleShare("native")}
        className="w-full bg-brand-orange text-white font-bold py-5 rounded-[1.75rem] shadow-lg shadow-brand-orange/25 active:scale-[0.98] transition-transform text-[15px] tracking-wide"
      >
        Share Flyer
      </button>

      <div className="grid grid-cols-3 gap-2">
        <ShareChip label="Instagram" onClick={() => handleShare("instagram")} />
        <ShareChip label="Facebook" onClick={() => handleShare("facebook")} />
        <ShareChip label="Copy Text" onClick={() => handleShare("copy")} />
      </div>

      <button
        onClick={handleDownload}
        className="w-full text-xs font-semibold text-brand-green/60 uppercase tracking-widest py-2"
      >
        {downloading ? "Preparing…" : "Save flyer as image / PDF"}
      </button>
    </section>
  );
}

function ShareChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-white border border-brand-green/5 rounded-full py-3 text-xs font-semibold text-brand-green active:scale-[0.97] transition"
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
  return (
    <div
      ref={ref}
      id="truckpost-flyer"
      className="relative overflow-hidden rounded-[2.25rem] bg-brand-orange p-1.5 shadow-2xl shadow-brand-orange/20"
    >
      <div className="bg-brand-paper rounded-[1.85rem] overflow-hidden">
        <div className="relative w-full aspect-[4/5] bg-stone-100">
          <img
            src={flyerFood}
            alt="Featured dish"
            width={1080}
            height={1350}
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 bg-brand-paper/95 backdrop-blur px-3 py-1.5 rounded-full">
            <span className="size-1.5 rounded-full bg-brand-orange animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green">
              {state.live ? "Live Today" : "Today's Menu"}
            </span>
          </div>
        </div>

        <div className="p-7 text-center space-y-4">
          <div className="inline-block bg-brand-orange text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em]">
            Today's Special
          </div>
          <h4 className="font-display text-3xl text-brand-green leading-tight italic text-balance">
            {state.special}
          </h4>
          <div className="h-px bg-brand-green/10 w-12 mx-auto" />

          <div className="space-y-1">
            <p className="text-brand-green/60 text-[10px] font-bold uppercase tracking-[0.2em]">
              Find us at
            </p>
            <p className="font-display text-xl text-brand-green text-balance">{state.location}</p>
            <p className="text-brand-green/70 text-sm font-medium">
              {state.hoursStart} — {state.hoursEnd}
            </p>
          </div>

          {state.menu.length > 0 && (
            <ul className="text-left max-w-[16rem] mx-auto pt-2 space-y-1.5">
              {state.menu.slice(0, 4).map((item) => (
                <li
                  key={item.id}
                  className="flex justify-between text-sm text-brand-green border-b border-dashed border-brand-green/15 pb-1.5"
                >
                  <span className="truncate pr-2 font-medium">{item.name}</span>
                  <span className="font-semibold text-brand-orange">${item.price}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="pt-4 flex flex-col items-center gap-2">
            <FauxQR />
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-green/50">
              Scan · Follow · Order
            </p>
          </div>

          <div className="pt-2 border-t border-brand-green/10">
            <p className="font-display text-lg text-brand-green">{state.name}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

function FauxQR() {
  // Deterministic pseudo-QR pattern — placeholder until Square/order link is wired.
  const cells = useMemo(() => {
    const size = 11;
    let seed = 42;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return Array.from({ length: size * size }, () => rand() > 0.55);
  }, []);
  return (
    <div className="relative size-20 bg-brand-paper border border-brand-green/10 rounded-xl p-2 grid grid-cols-11 gap-[1px]">
      {cells.map((on, i) => (
        <div key={i} className={on ? "bg-brand-green" : "bg-transparent"} />
      ))}
      {/* corner markers */}
      <span className="absolute top-2 left-2 size-4 border-[3px] border-brand-green bg-brand-paper rounded-[3px]" />
      <span className="absolute top-2 right-2 size-4 border-[3px] border-brand-green bg-brand-paper rounded-[3px]" />
      <span className="absolute bottom-2 left-2 size-4 border-[3px] border-brand-green bg-brand-paper rounded-[3px]" />
    </div>
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

/* ---------- Icons (inline, no dependencies) ---------- */

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
