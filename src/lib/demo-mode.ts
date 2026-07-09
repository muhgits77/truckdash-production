/**
 * Demo Mode — public showcase without giving away the full product.
 *
 * Toggle via .env (restart dev server after changing):
 *   NEXT_PUBLIC_DEMO_MODE=true
 *
 * Also accepted (Vite-native alias):
 *   VITE_DEMO_MODE=true
 *
 * Optional purchase link:
 *   NEXT_PUBLIC_DEMO_BUY_URL=https://yoursite.com/buy
 *   VITE_DEMO_BUY_URL=https://yoursite.com/buy
 */

function envTruthy(raw: string | boolean | undefined | null): boolean {
  if (raw === true) return true;
  if (raw === false || raw == null) return false;
  const v = String(raw).trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

function readEnv(key: string): string | undefined {
  // Vite injects import.meta.env.* at build time for matching envPrefix keys.
  try {
    const meta = import.meta.env as Record<string, string | boolean | undefined>;
    const v = meta[key];
    if (v != null && String(v).length > 0) return String(v);
  } catch {
    /* SSR / non-vite */
  }
  if (typeof process !== "undefined" && process.env) {
    const v = process.env[key];
    if (v != null && String(v).length > 0) return String(v);
  }
  return undefined;
}

/** True when the public demo is enabled. */
export const isDemoMode: boolean = envTruthy(
  readEnv("NEXT_PUBLIC_DEMO_MODE") ?? readEnv("VITE_DEMO_MODE"),
);

/** One-time full-version price shown in CTAs. */
export const DEMO_PRICE = "$597";

/** Purchase / upgrade URL (override in .env). */
export const DEMO_BUY_URL: string =
  readEnv("NEXT_PUBLIC_DEMO_BUY_URL") ??
  readEnv("VITE_DEMO_BUY_URL") ??
  "https://truckdash.app/buy";

/** Top banner copy. */
export const DEMO_BANNER_MESSAGE =
  "This is a Demo Version. Try it out! Full version unlocks unlimited flyers, exports, and features for $597 one-time.";

/** Short CTA label. */
export const DEMO_BUY_LABEL = `Buy Full Version – ${DEMO_PRICE}`;

/** Feature ids used by gates and UI. */
export type DemoLockedFeature =
  "export_flyer" | "publish_website" | "map_edit" | "export_json" | "share_image" | "high_res";

export const DEMO_FEATURE_MESSAGES: Record<DemoLockedFeature, string> = {
  export_flyer:
    "High-res flyer export is available in the full version. Design freely here — unlock unlimited PNGs for $597 one-time.",
  publish_website:
    "Publishing to your live website is a full-version feature. Preview and edit here, then unlock to go live.",
  map_edit:
    "Full live-map editing (GPS pin, multi-stop routing) is unlocked in the full version. Browse the map in demo.",
  export_json: "JSON export for custom websites is included with the full version.",
  share_image:
    "Sharing final flyer images is unlocked in the full version. Copy captions still work in demo.",
  high_res: "High-resolution exports are unlimited in the full version ($597 one-time).",
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
