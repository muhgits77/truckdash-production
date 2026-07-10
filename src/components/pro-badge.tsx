/**
 * Subtle Pro indicators for advanced TruckDash features ($2,497 tier).
 * Purely presentational — does not gate functionality.
 */
import type { ReactNode } from "react";

type Size = "xs" | "sm";

const sizeClass: Record<Size, string> = {
  xs: "text-[8px] px-1.5 py-0.5 gap-0.5",
  sm: "text-[9px] px-2 py-0.5 gap-1",
};

/**
 * Compact gold “Pro” chip — use next to feature titles (Flyer Studio, Live Map, Calendar).
 */
export function ProBadge({
  size = "xs",
  className = "",
  title = "Included with TruckDash Pro",
}: {
  size?: Size;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={[
        "pro-badge inline-flex items-center rounded-full font-bold uppercase tracking-[0.14em]",
        "text-[#1a3d2e] dark:text-[#1a3d2e]",
        "bg-gradient-to-b from-[#e8c45a] via-[#d4a437] to-[#c4922e]",
        "shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_1px_3px_rgba(184,114,44,0.28)]",
        "ring-1 ring-[#c48a3a]/25",
        "select-none shrink-0",
        sizeClass[size],
        className,
      ].join(" ")}
      aria-label="Pro feature"
    >
      <span aria-hidden className="text-[0.65em] leading-none opacity-90">
        ✦
      </span>
      Pro
    </span>
  );
}

/**
 * Title row with optional Pro badge — keeps layout tidy.
 */
export function ProTitle({
  children,
  badge = true,
  badgeSize = "xs",
  className = "",
  as: Tag = "h3",
}: {
  children: ReactNode;
  badge?: boolean;
  badgeSize?: Size;
  className?: string;
  as?: "h1" | "h2" | "h3" | "h4" | "span" | "p";
}) {
  return (
    <Tag className={["inline-flex items-center gap-2 min-w-0", className].join(" ")}>
      <span className="min-w-0 truncate">{children}</span>
      {badge && <ProBadge size={badgeSize} />}
    </Tag>
  );
}

/**
 * Soft premium shell for Pro feature sections (accent edge + gentle hover).
 * Does not change layout width — safe drop-in around existing cards.
 */
export function ProFeatureSurface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={["pro-feature-surface", className].filter(Boolean).join(" ")}>{children}</div>
  );
}
