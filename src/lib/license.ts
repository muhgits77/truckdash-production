/**
 * Simple license labeling — discourages casual reselling.
 *
 * Not hard DRM (the key is a public env var baked into the build). The goal is
 * a clear “Licensed to …” label for paying customers and a visible unlicensed
 * banner when the key is missing.
 *
 * How to deliver to a customer:
 *   1. Set in their .env (or host env vars, e.g. Vercel):
 *        VITE_LICENSE_KEY=Acme Food Trucks LLC
 *   2. Build / deploy. The app shows “Licensed to Acme Food Trucks LLC”.
 *   3. Omit the var (or leave it empty) → unlicensed banner.
 *
 * The value is the customer display name — no encoding, no generator.
 */

export const LICENSE_CONTACT_URL = "https://bluegrassdigitalforge.com/contact";

export const LICENSE_PURCHASE_MESSAGE =
  "Purchase a licensed copy from Bluegrass Digital Forge.";

export type LicenseStatus = {
  valid: boolean;
  /** Customer name from VITE_LICENSE_KEY when licensed. */
  customer: string | null;
};

/** Raw value of VITE_LICENSE_KEY (trimmed). Empty when unset. */
export function getEnvLicenseKey(): string {
  const raw = import.meta.env.VITE_LICENSE_KEY ?? "";
  return String(raw).trim();
}

/**
 * Resolve license status from VITE_LICENSE_KEY.
 * Any non-empty string is treated as a valid license (the string is the name).
 */
export function resolveLicense(): LicenseStatus {
  const key = getEnvLicenseKey();
  if (!key) {
    return { valid: false, customer: null };
  }
  return { valid: true, customer: key };
}

/** True when VITE_LICENSE_KEY is set to a non-empty string. */
export function isLicensed(): boolean {
  return resolveLicense().valid;
}
