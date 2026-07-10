/**
 * Demo Mode — public showcase without giving away the full product.
 *
 * Toggle via .env (restart dev server after changing):
 *   NEXT_PUBLIC_DEMO_MODE=true
 *   # or: VITE_DEMO_MODE=true
 *
 * Sales CTAs open the Bluegrass Digital Forge contact form
 * (https://bluegrassdigitalforge.com/contact) — same as the main site’s
 * Contact / Get a Quote flow. No mailto, no email app, no xdg-open.
 *
 * IMPORTANT: isDemoMode is derived only from import.meta.env so SSR and the
 * browser always agree (avoids React hydration mismatches).
 */

function envTruthy(raw: string | boolean | undefined | null): boolean {
  if (raw === true) return true;
  if (raw === false || raw == null) return false;
  const v = String(raw).trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

/**
 * Build-time flag only — Vite replaces import.meta.env.* on both server and client.
 * Do NOT fall back to process.env here (that caused SSR/client divergence).
 */
export const isDemoMode: boolean = envTruthy(
  import.meta.env.NEXT_PUBLIC_DEMO_MODE ?? import.meta.env.VITE_DEMO_MODE,
);

/** Plan prices (one-time unless noted). */
export const DEMO_PRICE_STARTER = "$1,497";
export const DEMO_PRICE_PRO = "$2,497";
/** Launch offer for first 10 KY trucks (through August 2026). */
export const DEMO_PRICE_PRO_LAUNCH = "$1,997";
/** Short price phrase for banners / toasts. */
export const DEMO_PRICE = "from $1,497";

/**
 * Contact form on the main site — same destination as “Contact” / “Get a Quote”.
 * Sends securely via the form (no email app opens).
 */
export const DEMO_CONTACT_URL = "https://bluegrassdigitalforge.com/contact";

/** @deprecated Use DEMO_CONTACT_URL — kept so older imports keep working. */
export const DEMO_BUY_URL = DEMO_CONTACT_URL;

/** Default sales CTA label (banners / toasts). Plan cards use “Buy Now”. */
export const DEMO_BUY_LABEL = "Contact for Sales";

/** @deprecated Use DEMO_BUY_LABEL — kept for call sites. */
export const DEMO_BUY_LABEL_SHORT = DEMO_BUY_LABEL;

/** Top banner copy. */
export const DEMO_BANNER_MESSAGE =
  "This is a Demo Version. Try it out! TruckDash plans start at $1,497 — honest pricing, no hidden fees, lifetime updates.";

/** Feature ids used by gates and UI. */
export type DemoLockedFeature =
  | "export_flyer"
  | "publish_website"
  | "map_edit"
  | "export_json"
  | "share_image"
  | "high_res";

export const DEMO_FEATURE_MESSAGES: Record<DemoLockedFeature, string> = {
  export_flyer:
    "High-res flyer export is available with a TruckDash license. Design freely here — unlock unlimited PNGs on Starter or Pro.",
  publish_website:
    "Publishing to your live website is a Pro feature. Preview and edit here, then unlock to go live.",
  map_edit:
    "Full live-map editing (GPS pin, multi-stop routing) is unlocked with a TruckDash license. Browse the map in demo.",
  export_json:
    "JSON export for custom websites is included with Starter and Pro.",
  share_image:
    "Sharing final flyer images unlocks with a TruckDash license. Copy captions still work in demo.",
  high_res:
    "High-resolution exports are unlimited with a TruckDash license (Starter from $1,497).",
};

/** Pixel ratio for demo preview captures (if ever allowed). Full product uses 3. */
export const DEMO_EXPORT_PIXEL_RATIO = 1;
export const FULL_EXPORT_PIXEL_RATIO = 3;

/**
 * Run `action` only when not in demo mode.
 * Returns true if the action ran; false if blocked.
 */
export function runUnlessDemo(
  feature: DemoLockedFeature,
  action: () => void,
  onBlocked?: (message: string) => void,
): boolean {
  if (!isDemoMode) {
    action();
    return true;
  }
  onBlocked?.(DEMO_FEATURE_MESSAGES[feature]);
  return false;
}

/**
 * Async variant — skips `action` when demo mode is on.
 */
export async function runUnlessDemoAsync(
  feature: DemoLockedFeature,
  action: () => void | Promise<void>,
  onBlocked?: (message: string) => void,
): Promise<boolean> {
  if (!isDemoMode) {
    await action();
    return true;
  }
  onBlocked?.(DEMO_FEATURE_MESSAGES[feature]);
  return false;
}

export function demoExportPixelRatio(): number {
  return isDemoMode ? DEMO_EXPORT_PIXEL_RATIO : FULL_EXPORT_PIXEL_RATIO;
}
