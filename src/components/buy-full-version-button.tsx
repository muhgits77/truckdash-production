/**
 * Sales CTA — opens the Bluegrass Digital Forge contact form
 * (same as Contact / Get a Quote on bluegrassdigitalforge.com).
 * No mailto — no email client / xdg-open dialog.
 */
import { DEMO_BUY_LABEL, DEMO_CONTACT_URL, isDemoMode } from "@/lib/demo-mode";

type Size = "sm" | "md" | "lg";

const sizeClass: Record<Size, string> = {
  sm: "px-3 py-2 text-[11px] rounded-xl",
  md: "px-4 py-2.5 text-sm rounded-2xl",
  lg: "px-5 py-3.5 text-sm rounded-2xl w-full",
};

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

  return (
    <a
      href={DEMO_CONTACT_URL}
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
      {label || "Contact for Sales"}
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
      <p className="mt-3 text-[12px] text-[color:var(--td-ink-muted)] leading-snug">
        Ready to go live? Open the contact form on our main site — same as <strong>Contact</strong>{" "}
        on bluegrassdigitalforge.com. No email app opens.
      </p>
      <div className="mt-4">
        <a
          href={DEMO_CONTACT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={[
            "inline-flex items-center justify-center gap-1.5 font-bold text-white",
            "bg-brand-orange hover:bg-brand-orange/90 active:scale-[0.98]",
            "shadow-md shadow-brand-orange/25 transition",
            sizeClass.lg,
          ].join(" ")}
        >
          <span aria-hidden>✦</span>
          Contact for Sales
        </a>
      </div>
    </section>
  );
}
