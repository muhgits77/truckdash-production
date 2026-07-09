/**
 * Prominent “Buy Full Version – $597” CTA used across Demo Mode surfaces.
 */
import { DEMO_BUY_LABEL, DEMO_BUY_URL, isDemoMode } from "@/lib/demo-mode";

type Size = "sm" | "md" | "lg";

const sizeClass: Record<Size, string> = {
  sm: "px-3 py-2 text-[11px] rounded-xl",
  md: "px-4 py-2.5 text-sm rounded-2xl",
  lg: "px-5 py-3.5 text-sm rounded-2xl w-full",
};

export function BuyFullVersionButton({
  size = "md",
  href = DEMO_BUY_URL,
  className = "",
  label = DEMO_BUY_LABEL,
  /** When true, render even if demo mode is off (e.g. marketing pages). */
  alwaysShow = false,
}: {
  size?: Size;
  href?: string;
  className?: string;
  label?: string;
  alwaysShow?: boolean;
}) {
  if (!isDemoMode && !alwaysShow) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        "inline-flex items-center justify-center gap-1.5 font-bold text-white",
        "bg-brand-orange hover:bg-brand-orange/90 active:scale-[0.98]",
        "shadow-md shadow-brand-orange/25 transition",
        sizeClass[size],
        className,
      ].join(" ")}
    >
      <span aria-hidden>✦</span>
      {label}
    </a>
  );
}

/** Card-style upsell block for home / flyer studio. */
export function BuyFullVersionCard({ className = "" }: { className?: string }) {
  if (!isDemoMode) return null;

  return (
    <section
      className={`td-card td-card-pad border-brand-orange/30 bg-gradient-to-br from-[color:var(--surface)] to-brand-orange/5 ${className}`}
    >
      <p className="td-section-label text-brand-orange">Unlock everything</p>
      <h3 className="font-display text-xl mt-1.5 tracking-tight text-[color:var(--td-ink)]">
        Full TruckDash — $597 one-time
      </h3>
      <ul className="mt-3 space-y-1.5 text-sm text-[color:var(--td-ink-muted)]">
        <li>· Unlimited high-res flyer exports &amp; social shares</li>
        <li>· Publish menu &amp; schedule to your live website</li>
        <li>· Full live-map GPS &amp; multi-stop editing</li>
        <li>· JSON export for custom sites</li>
      </ul>
      <div className="mt-4">
        <BuyFullVersionButton size="lg" />
      </div>
    </section>
  );
}
