/**
 * My Listings Manager — personal vendor profile for the public site.
 * Edit tagline, description, cuisine, photos; live toggle syncs to state.live.
 * High-contrast Kentucky palette (light + dark).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { PageShell, TipCard } from "@/components/page-shell";
import { useTruckState } from "@/lib/truck-state";
import { getConfiguredTruckId, DEFAULT_TRUCK_ID } from "@/lib/publishService";
import { menuJsonPublicUrl } from "@/lib/menuStorage";
import { isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/listings")({
  head: () => ({
    meta: [
      { title: "My Listings — TruckDash" },
      {
        name: "description",
        content: "Manage your food truck public profile, menu highlights, and live status.",
      },
    ],
  }),
  component: ListingsPage,
});

function ListingsPage() {
  const [state, setState] = useTruckState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const truckId =
    typeof window !== "undefined"
      ? getConfiguredTruckId().trim() || DEFAULT_TRUCK_ID
      : DEFAULT_TRUCK_ID;

  const listing = state.listing;
  const isLive = state.liveSession?.isLive || state.live;

  const updateListing = (patch: Partial<typeof listing>) => {
    setState({ ...state, listing: { ...listing, ...patch } });
  };

  const toggleLive = () => {
    const next = !isLive;
    setState({
      ...state,
      live: next,
      liveSession: {
        ...state.liveSession,
        isLive: next,
        label: state.liveSession.label || state.location,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  const onPhoto = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      if (!url) return;
      setState({
        ...state,
        heroPhoto: state.heroPhoto || url,
        listing: {
          ...listing,
          photos: [...listing.photos, url].slice(0, 8),
        },
      });
    };
    reader.readAsDataURL(file);
  };

  const flashSave = () => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const highlights = state.menu.slice(0, 4);

  return (
    <PageShell title="My Listings" eyebrow="Public profile" live={isLive}>
      <TipCard>
        Your listing card feeds the public website after{" "}
        <strong className="text-brand-orange">Publish</strong>. Live toggle matches Live Map.
      </TipCard>

      <section className="td-card overflow-hidden">
        <div
          className="h-32 bg-gradient-to-br from-[#1a3d2e] via-[#2a5a42] to-[#4a2c1a] relative"
          style={
            state.heroPhoto
              ? {
                  backgroundImage: `linear-gradient(to top, rgba(12,31,22,0.88), transparent 55%), url(${state.heroPhoto})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <div className="absolute bottom-3.5 left-4 right-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">
                {listing.cuisine || "Food truck"}
              </p>
              <h2 className="font-display text-2xl text-white leading-tight truncate">
                {state.name}
              </h2>
            </div>
            {isLive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange text-white text-[10px] font-bold uppercase px-2.5 py-1 shadow shrink-0">
                <span className="size-1.5 rounded-full bg-white animate-pulse" /> Live
              </span>
            )}
          </div>
        </div>
        <div className="p-5 space-y-3.5">
          <p className="text-sm font-semibold text-[color:var(--td-ink)] leading-snug">
            {listing.tagline}
          </p>
          <p className="text-sm text-[color:var(--td-ink-muted)] leading-relaxed">
            {listing.description}
          </p>
          <p className="text-xs font-medium text-[color:var(--td-ink-muted)]">
            {listing.serviceArea}
          </p>
          {highlights.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {highlights.map((m) => (
                <li
                  key={m.id}
                  className="rounded-full bg-[color:var(--surface-2)] border border-[color:var(--border)] px-2.5 py-1.5 text-[11px] font-semibold text-[color:var(--td-ink)]"
                >
                  {m.name} · ${m.price}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2.5 pt-1">
            <Link
              to="/website"
              className="flex-1 text-center py-3 rounded-xl bg-brand-orange text-white text-xs font-bold shadow-md shadow-brand-orange/20"
            >
              Preview public site
            </Link>
            <Link
              to="/live-map"
              className="flex-1 text-center py-3 rounded-xl border border-[color:var(--border)] text-xs font-bold text-[color:var(--td-ink)] bg-[color:var(--surface)]"
            >
              Live Map
            </Link>
          </div>
        </div>
      </section>

      <section className="td-card td-card-pad flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-display text-lg tracking-tight text-[color:var(--td-ink)]">
            Live on public site
          </h3>
          <p className="text-sm text-[color:var(--td-ink-muted)] mt-1 leading-snug">
            Syncs with Live Map · {isLive ? "Customers can find you" : "Hidden as offline"}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isLive}
          onClick={toggleLive}
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
      </section>

      <section className="td-card td-card-pad space-y-4">
        <h3 className="font-display text-lg tracking-tight text-[color:var(--td-ink)]">
          Edit profile
        </h3>
        <Field label="Truck name">
          <input
            value={state.name}
            onChange={(e) => setState({ ...state, name: e.target.value })}
            className="td-input"
          />
        </Field>
        <Field label="Tagline">
          <input
            value={listing.tagline}
            onChange={(e) => updateListing({ tagline: e.target.value })}
            className="td-input"
            placeholder="Lake Cumberland BBQ · Kentucky soul"
          />
        </Field>
        <Field label="Cuisine">
          <input
            value={listing.cuisine}
            onChange={(e) => updateListing({ cuisine: e.target.value })}
            className="td-input"
            placeholder="BBQ · Southern"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={listing.description}
            onChange={(e) => updateListing({ description: e.target.value })}
            rows={3}
            className="td-input resize-none"
          />
        </Field>
        <Field label="Service area">
          <input
            value={listing.serviceArea}
            onChange={(e) => updateListing({ serviceArea: e.target.value })}
            className="td-input"
          />
        </Field>
        <Field label="Phone">
          <input
            value={state.phone}
            onChange={(e) => setState({ ...state, phone: e.target.value })}
            className="td-input"
          />
        </Field>
        <Field label="Today's location">
          <input
            value={state.location}
            onChange={(e) => setState({ ...state, location: e.target.value })}
            className="td-input"
          />
        </Field>
        <Field label="Special">
          <input
            value={state.special}
            onChange={(e) => setState({ ...state, special: e.target.value })}
            className="td-input"
          />
        </Field>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--td-ink-muted)] mb-2">
            Photos
          </p>
          <div className="flex flex-wrap gap-2.5">
            {listing.photos.map((p, i) => (
              <div
                key={i}
                className="relative size-16 rounded-xl overflow-hidden border border-[color:var(--border)]"
              >
                <img src={p} alt="" className="size-full object-cover" />
                <button
                  type="button"
                  className="absolute top-0.5 right-0.5 size-5 rounded-full bg-[#1a3d2e]/90 text-white text-[10px]"
                  onClick={() =>
                    updateListing({ photos: listing.photos.filter((_, j) => j !== i) })
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="size-16 rounded-xl border-2 border-dashed border-[color:var(--border)] text-[color:var(--td-ink-muted)] text-xs font-bold hover:border-brand-orange/40 transition"
            >
              + Add
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <button type="button" onClick={flashSave} className="td-btn-primary">
          {savedFlash ? "Saved to this device ✓" : "Save profile"}
        </button>
        <p className="text-[11px] text-center text-[color:var(--td-ink-muted)] leading-relaxed">
          Auto-saves as you type. Publish from Home to push menu/schedule to the website.
        </p>
      </section>

      {isSupabaseConfigured() && (
        <p className="text-[11px] text-center text-[color:var(--td-ink-muted)] break-all px-2 leading-relaxed">
          Public menu JSON: {menuJsonPublicUrl(truckId)}
        </p>
      )}
    </PageShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--td-ink-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}
