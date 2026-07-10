/**
 * Sales CTAs + pricing plans — open the Bluegrass Digital Forge contact form
 * (same as Contact / Get a Quote on bluegrassdigitalforge.com).
 * No mailto — no email client / xdg-open dialog.
 *
 * Brand: premium Kentucky soul — deep green, bourbon amber, cream, warm walnut.
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
  variant = "default",
}: {
  label: string;
  size?: Size;
  className?: string;
  /** Optional plan hint for the sales form (query string). */
  plan?: "starter" | "pro" | "addon" | "contact";
  /** Pro CTA uses gold-on-deep-green for premium conversion. */
  variant?: "default" | "pro";
}) {
  const href =
    plan && plan !== "contact"
      ? `${DEMO_CONTACT_URL}?plan=${plan}`
      : DEMO_CONTACT_URL;

  if (variant === "pro") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title="Contact Bluegrass Digital Forge — open contact form"
        className={[
          "group relative inline-flex w-full items-center justify-center gap-2",
          "rounded-2xl px-5 py-4 text-[15px] font-bold tracking-wide",
          "text-[#1a3d2e]",
          "bg-gradient-to-b from-[#e8c45a] via-[#d4a437] to-[#c4922e]",
          "shadow-[0_4px_0_#8a6a1a,0_12px_28px_rgba(212,164,55,0.35)]",
          "hover:from-[#f0d06a] hover:via-[#e0b040] hover:to-[#d4a437]",
          "active:translate-y-[2px] active:shadow-[0_2px_0_#8a6a1a,0_6px_16px_rgba(212,164,55,0.3)]",
          "transition-all duration-200",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a437]",
          className,
        ].join(" ")}
      >
        <span
          className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"
          aria-hidden
        />
        <span aria-hidden className="text-[13px] opacity-90">
          ✦
        </span>
        {label}
        <span
          aria-hidden
          className="text-[12px] opacity-70 transition-transform duration-200 group-hover:translate-x-0.5"
        >
          →
        </span>
      </a>
    );
  }

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

function FeatureCheck({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 leading-snug">
      <span
        className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#1a3d2e]/10 text-[#1a3d2e] dark:bg-[#d4a437]/15 dark:text-[#e4bc52]"
        aria-hidden
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="block">
          <path
            d="M2 5.2L4.1 7.3L8 2.8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>{children}</span>
    </li>
  );
}

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

      {/* ── Pro — Most Popular (premium highlight) ───────────────────────── */}
      <article
        className="relative mt-4 overflow-hidden rounded-[1.35rem] border border-[#c48a3a]/40 dark:border-[#d4a437]/35"
        style={{
          background:
            "linear-gradient(165deg, color-mix(in srgb, #fffdf6 92%, #d4a437) 0%, var(--surface) 42%, color-mix(in srgb, var(--surface) 94%, #1a3d2e) 100%)",
          boxShadow:
            "0 1px 0 color-mix(in srgb, #d4a437 35%, transparent), 0 14px 40px rgba(26, 61, 46, 0.12), 0 4px 12px rgba(184, 114, 44, 0.08)",
        }}
        aria-labelledby="pro-plan-heading"
      >
        {/* Deep green top ribbon */}
        <div
          className="relative flex items-center justify-between gap-2 px-4 py-2.5"
          style={{
            background: "linear-gradient(90deg, #1a3d2e 0%, #243f32 50%, #1a3d2e 100%)",
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#e8d5a3]/90">
            Full Bluegrass Command Center
          </p>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#d4a437] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#1a3d2e] shadow-sm">
            <span aria-hidden className="text-[8px]">
              ★
            </span>
            Most Popular
          </span>
        </div>

        <div className="p-4 pt-5 sm:p-5">
          {/* Title + price block */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3
                id="pro-plan-heading"
                className="font-display text-[1.65rem] leading-none tracking-tight text-[color:var(--td-ink)]"
              >
                Pro
              </h3>
              <p className="mt-1.5 text-[13px] font-medium leading-snug text-[color:var(--td-ink-muted)]">
                Everything you need to run multiple days, events, and a live website.
              </p>
            </div>

            {/* Clean price hierarchy: was → now → save */}
            <div
              className="shrink-0 rounded-2xl border border-[#c48a3a]/25 bg-[color:var(--surface)] px-4 py-3 text-left sm:min-w-[9.5rem] sm:text-right"
              style={{
                boxShadow: "inset 0 1px 0 color-mix(in srgb, #d4a437 20%, transparent)",
              }}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--td-ink-muted)]">
                Launch price
              </p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0 sm:justify-end">
                <span
                  className="text-[13px] font-semibold tabular-nums text-[color:var(--td-ink-muted)] line-through decoration-[#a1281e]/50"
                  aria-label={`Was ${DEMO_PRICE_PRO}`}
                >
                  {DEMO_PRICE_PRO}
                </span>
                <span
                  className="font-display text-[1.85rem] font-bold leading-none tabular-nums text-[#1a3d2e] dark:text-[#e4bc52]"
                  aria-label={`Now ${DEMO_PRICE_PRO_LAUNCH}`}
                >
                  {DEMO_PRICE_PRO_LAUNCH}
                </span>
              </p>
              <p className="mt-1.5">
                <span className="inline-flex items-center rounded-full bg-[#1a3d2e] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#f5efe1] dark:bg-[#d4a437] dark:text-[#1a3d2e]">
                  Save $500
                </span>
              </p>
              <p className="mt-1.5 text-[10px] font-medium text-[color:var(--td-ink-muted)]">
                one-time · lifetime updates
              </p>
            </div>
          </div>

          {/* Features */}
          <ul className="mt-5 space-y-2.5 text-[13px] text-[color:var(--td-ink-muted)]">
            {PRO_FEATURES.map((f) => (
              <FeatureCheck key={f}>{f}</FeatureCheck>
            ))}
          </ul>

          {/* Best for */}
          <p className="mt-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-2)] px-3 py-2.5 text-[12px] leading-relaxed text-[color:var(--td-ink-muted)]">
            <span className="font-semibold text-[color:var(--td-ink)]">Best for:</span> Established
            trucks like Bluegrass Kitchen running multiple days + events.
          </p>

          {/* CTA */}
          <div className="mt-5">
            <BuyLink label="Buy Now — Pro" plan="pro" variant="pro" />
            <p className="mt-2.5 text-center text-[11px] leading-snug text-[color:var(--td-ink-muted)]">
              Opens our secure contact form · no payment taken here · honest local service
            </p>
          </div>
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
