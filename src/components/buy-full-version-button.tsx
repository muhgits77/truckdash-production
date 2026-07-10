/**
 * Sales CTAs + pricing plans — open the Bluegrass Digital Forge contact form
 * (same as Contact / Get a Quote on bluegrassdigitalforge.com).
 * No mailto — no email client / xdg-open dialog.
 */
import {
  DEMO_BUY_LABEL,
  DEMO_CONTACT_URL,
  DEMO_PRICE_PRO,
  DEMO_PRICE_PRO_LAUNCH,
  DEMO_PRICE_STARTER,
  isDemoMode,
} from "@/lib/demo-mode";

type Size = "sm" | "md" | "lg";

const sizeClass: Record<Size, string> = {
  sm: "px-3 py-2 text-[11px] rounded-xl",
  md: "px-4 py-2.5 text-sm rounded-2xl",
  lg: "px-5 py-3.5 text-sm rounded-2xl w-full",
};

function BuyLink({
  label,
  size = "md",
  className = "",
  plan,
}: {
  label: string;
  size?: Size;
  className?: string;
  /** Optional plan hint for the sales form (query string). */
  plan?: "starter" | "pro" | "addon" | "contact";
}) {
  const href =
    plan && plan !== "contact"
      ? `${DEMO_CONTACT_URL}?plan=${plan}`
      : DEMO_CONTACT_URL;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Contact Bluegrass Digital Forge — open contact form"
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

export function BuyFullVersionButton({
  size = "md",
  className = "",
  label = DEMO_BUY_LABEL,
  /** When true, render even if demo mode is off. */
  alwaysShow = false,
}: {
  size?: Size;
  className?: string;
  label?: string;
  alwaysShow?: boolean;
}) {
  if (!isDemoMode && !alwaysShow) return null;

  return <BuyLink label={label || "Contact for Sales"} size={size} className={className} />;
}

const STARTER_FEATURES = [
  "Core Dashboard & Schedule Manager",
  "Basic Flyer Studio (templates + QR codes)",
  "One-tap JSON export for your website",
  "Offline mode",
  "Kentucky-style design & branding kit",
] as const;

const PRO_FEATURES = [
  "Everything in Starter",
  "Advanced Flyer Studio (stories, social presets, custom backgrounds)",
  "Supabase sync + one-tap publish to your live website",
  "Custom branding & menu import",
  "Priority email support + 1 year maintenance",
  "PWA-ready for mobile crew access",
] as const;

const ADDONS = [
  { name: "Custom Menu Import & Data Migration", price: "$497" },
  { name: "Full PWA + Mobile App Setup", price: "$497" },
  { name: "Ongoing Hosting & Updates", price: "$397/year" },
  { name: "White-Label / Multi-Truck License", price: "Contact us" },
] as const;

/** Full pricing section for home / demo sales. */
export function BuyFullVersionCard({ className = "" }: { className?: string }) {
  if (!isDemoMode) return null;

  return (
    <section
      className={`td-card td-card-pad border-brand-orange/30 bg-gradient-to-br from-[color:var(--surface)] to-brand-orange/5 ${className}`}
      aria-labelledby="pricing-heading"
    >
      <p className="td-section-label text-brand-orange">Honest pricing</p>
      <h2
        id="pricing-heading"
        className="font-display text-xl mt-1.5 tracking-tight text-[color:var(--td-ink)]"
      >
        Choose Your TruckDash Plan
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--td-ink-muted)]">
        Built for Kentucky food truckers who work hard and deserve tools that make life easier. No
        hidden fees — lifetime updates for your purchase.
      </p>

      {/* Starter */}
      <article className="mt-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-lg tracking-tight text-[color:var(--td-ink)]">
              Starter
            </h3>
            <p className="text-[12px] font-semibold text-brand-orange mt-0.5">
              Perfect for getting started
            </p>
          </div>
          <p className="shrink-0 text-right">
            <span className="font-display text-2xl font-bold text-[color:var(--td-ink)] tabular-nums">
              {DEMO_PRICE_STARTER}
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[color:var(--td-ink-muted)]">
              one-time
            </span>
          </p>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm text-[color:var(--td-ink-muted)]">
          {STARTER_FEATURES.map((f) => (
            <li key={f} className="flex gap-2 leading-snug">
              <span className="text-brand-orange shrink-0" aria-hidden>
                ·
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] text-[color:var(--td-ink-muted)]">
          <span className="font-semibold text-[color:var(--td-ink)]">Best for:</span> New trucks or
          simple operations.
        </p>
        <div className="mt-4">
          <BuyLink label="Buy Now" size="lg" plan="starter" />
        </div>
      </article>

      {/* Pro */}
      <article className="mt-3 rounded-2xl border-2 border-brand-orange/50 bg-gradient-to-b from-brand-orange/10 to-[color:var(--surface)] p-4 relative overflow-hidden">
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center rounded-full bg-brand-orange text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 shadow-sm">
            Most Popular
          </span>
        </div>
        <div className="flex items-start justify-between gap-2 pr-16 sm:pr-20">
          <div>
            <h3 className="font-display text-lg tracking-tight text-[color:var(--td-ink)]">Pro</h3>
            <p className="text-[12px] font-semibold text-brand-orange mt-0.5">
              The full Bluegrass Command Center
            </p>
          </div>
          <p className="shrink-0 text-right">
            <span className="block text-[11px] line-through text-[color:var(--td-ink-muted)] tabular-nums">
              {DEMO_PRICE_PRO}
            </span>
            <span className="font-display text-2xl font-bold text-[color:var(--td-ink)] tabular-nums">
              {DEMO_PRICE_PRO_LAUNCH}
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[color:var(--td-ink-muted)]">
              launch offer
            </span>
          </p>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm text-[color:var(--td-ink-muted)]">
          {PRO_FEATURES.map((f) => (
            <li key={f} className="flex gap-2 leading-snug">
              <span className="text-brand-orange shrink-0" aria-hidden>
                ·
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] text-[color:var(--td-ink-muted)]">
          <span className="font-semibold text-[color:var(--td-ink)]">Best for:</span> Established
          trucks like Bluegrass Kitchen running multiple days + events.
        </p>
        <p className="mt-2 text-[11px] font-semibold text-brand-orange">
          Save $500 with launch offer
        </p>
        <div className="mt-4">
          <BuyLink label="Buy Now" size="lg" plan="pro" />
        </div>
      </article>

      {/* Add-ons */}
      <div className="mt-5">
        <p className="td-section-label">Add-Ons</p>
        <ul className="mt-2.5 space-y-2">
          {ADDONS.map((a) => (
            <li
              key={a.name}
              className="flex items-start justify-between gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5"
            >
              <span className="text-[13px] text-[color:var(--td-ink)] leading-snug">{a.name}</span>
              <span className="shrink-0 text-[12px] font-bold tabular-nums text-brand-orange">
                {a.price}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <BuyLink
            label="Ask about add-ons"
            size="md"
            plan="addon"
            className="w-full !bg-transparent !text-[color:var(--td-ink)] !shadow-none border border-[color:var(--border)] hover:!bg-brand-orange/10"
          />
        </div>
      </div>

      {/* Launch offer callout */}
      <div
        className="mt-5 rounded-2xl px-4 py-3.5 border border-[#c48a3a]/35"
        style={{
          background: "linear-gradient(135deg, #1a3d2e 0%, #2a5240 55%, #1a3d2e 100%)",
        }}
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#d4a437]">
          Limited Launch Offer
        </p>
        <p className="mt-1 text-sm font-semibold text-white leading-snug">
          First 10 Kentucky Food Trucks get{" "}
          <span className="text-[#d4a437]">Pro for only {DEMO_PRICE_PRO_LAUNCH}</span>
        </p>
        <p className="mt-1.5 text-[11px] text-white/80 leading-snug">
          Valid through August 2026 — Russell Springs, Jamestown, Monticello &amp; Lake Cumberland
          operators priority
        </p>
      </div>

      {/* Testimonial */}
      <blockquote className="mt-4 border-l-2 border-brand-gold/60 pl-3">
        <p className="text-[13px] italic text-[color:var(--td-ink-muted)] leading-relaxed">
          “Finally a tool that feels like it was built by someone who actually understands food
          truck life in Kentucky.”
        </p>
        <footer className="mt-1.5 text-[11px] font-semibold text-[color:var(--td-ink)]">
          — Bluegrass Kitchen
        </footer>
      </blockquote>
    </section>
  );
}
